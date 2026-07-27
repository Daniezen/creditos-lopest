import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  reconcileClientDocuments,
  type ReconcileClientDocumentsResult,
} from "@/server/drive/client-documents-reconciliation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CronReconciliationResult =
  | ({ ok: true } & ReconcileClientDocumentsResult)
  | {
      ok: false;
      clienteId: string;
      error: string;
    };

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;

/** Processes a bounded batch so n8n can orchestrate without request timeouts. */
export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      cursor?: string;
      limit?: number;
    };
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

function hasValidSecret(request: Request): boolean {
  const expected = process.env.DOCUMENTOS_CRON_SECRET?.trim();
  const provided = request.headers.get("x-cron-secret")?.trim();
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function normalizeLimit(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || !value || value <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(value, MAX_BATCH_SIZE);
}
