import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { entityId } from "@/server/validation/input";
import {
  reconcileClientDocuments,
  type ReconcileClientDocumentsResult,
} from "@/server/drive/client-documents-reconciliation.service";
import { secretsMatch } from "@/server/security/cron-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CronReconciliationResult =
  | ({ ok: true } & ReconcileClientDocumentsResult)
  | {
      ok: false;
      clienteId: string;
      error: string;
    };

/**
 * n8n posts `{ cursor?, limit? }`. An empty or non-JSON body still means
 * "first page, default size" (the `catch` above), and an out-of-range limit is
 * still clamped by `normalizeLimit`; what the schema refuses is a cursor that
 * is not an id, which Prisma would otherwise receive verbatim.
 */
const cronBodySchema = z.preprocess(
  // A JSON body that is not an object (`null`, `[]`, `"x"`) keeps the old
  // "use defaults" behaviour.
  (value) => (value !== null && typeof value === "object" && !Array.isArray(value) ? value : {}),
  z.object({
    cursor: entityId("cursor").optional(),
    // Non-numeric limits used to fall back to the default; they still do.
    limit: z.unknown().transform((value) => (typeof value === "number" ? value : undefined)),
  }),
);

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;

/** Processes a bounded batch so n8n can orchestrate without request timeouts. */
export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const parsedBody = cronBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Cuerpo inválido." },
        { status: 400 },
      );
    }
    const body = parsedBody.data;
    const limit = normalizeLimit(body.limit);
    const clientes = await prisma.cliente.findMany({
      where: {
        carpetaAdjuntosUrl: { not: null },
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(body.cursor
        ? {
            cursor: { id: body.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = clientes.length > limit;
    const batch = clientes.slice(0, limit);
    const results: CronReconciliationResult[] = [];

    // Two concurrent workers bound Drive and database pressure.
    let cursor = 0;
    async function worker() {
      while (cursor < batch.length) {
        const cliente = batch[cursor++];
        try {
          const result = await reconcileClientDocuments({
            clienteId: cliente.id,
            reason: "CRON",
          });
          results.push({ ok: true, ...result });
        } catch (error) {
          console.error("Drive client reconciliation failed", {
            clienteId: cliente.id,
            error,
          });
          results.push({
            ok: false,
            clienteId: cliente.id,
            error: error instanceof Error ? error.message : "Error desconocido.",
          });
        }
      }
    }

    await Promise.all([worker(), worker()]);

    return NextResponse.json({
      ok: true,
      processed: batch.length,
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      nextCursor: hasMore ? batch.at(-1)?.id ?? null : null,
      hasMore,
      results,
    });
  } catch (error) {
    console.error("Drive reconciliation cron failed", { error });
    return NextResponse.json(
      { ok: false, error: "Fallo la sincronizacion documental." },
      { status: 500 },
    );
  }
}

/** Constant-time check of `x-cron-secret: <DOCUMENTOS_CRON_SECRET>` (both trimmed). */
function hasValidSecret(request: Request): boolean {
  return secretsMatch(
    request.headers.get("x-cron-secret")?.trim(),
    process.env.DOCUMENTOS_CRON_SECRET?.trim(),
  );
}

function normalizeLimit(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || !value || value <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(value, MAX_BATCH_SIZE);
}
