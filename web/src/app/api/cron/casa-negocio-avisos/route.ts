import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { avisosNuevosDelDia } from "@/server/casa-negocio/avisos-envio";
import { logEvent } from "@/server/observability/log";
import { readBearerToken, secretsMatch } from "@/server/security/cron-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily Casa y Negocio avisos for Telegram (see `avisos-envio.ts`).
 *
 * Contract with n8n (`n8n/LOPEST - Avisos Casa y Negocio a Telegram.json`):
 *   POST, header `Authorization: Bearer <CASA_NEGOCIO_CRON_SECRET>`, no body.
 *   200 `{ ok: true, estado, hoy, nuevos: [...], mensaje }`. `mensaje` is the
 *   ready-to-send plain text, or null when there is nothing new (n8n then
 *   sends nothing). `estado: "sin-modulo"` means the module has no opened
 *   accounts yet (before 1-dic): nothing is evaluated nor recorded.
 *
 * POST, not GET: each call records what it reported, so it is not safe to
 * repeat blindly (a second call the same day returns no news by design).
 *
 * The secret is its own variable, not the credits one: a leaked n8n
 * credential for this flow cannot recompute overdue quotas, and vice versa.
 * Unset secret = endpoint closed (`secretsMatch` fails closed).
 */
function isAuthorized(request: Request): boolean {
  return secretsMatch(
    readBearerToken(request.headers.get("authorization")),
    process.env.CASA_NEGOCIO_CRON_SECRET,
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    const resultado = await avisosNuevosDelDia(prisma, { urlModulo: base ? `${base}/casa-negocio` : null });
    logEvent("info", "casa_negocio.avisos_evaluados", {
      estado: resultado.estado,
      hoy: resultado.hoy,
      nuevos: resultado.nuevos.length,
      vigentes: resultado.estado === "ok" ? resultado.vigentes : 0,
      resueltos: resultado.estado === "ok" ? resultado.resueltos : 0,
    });
    return NextResponse.json({
      ok: true,
      estado: resultado.estado,
      hoy: resultado.hoy,
      nuevos: resultado.nuevos.map(({ codigo, numero, nivel, texto }) => ({ codigo, numero, nivel, texto })),
      mensaje: resultado.mensaje,
    });
  } catch (error) {
    // Details stay in the server log; n8n only learns that the run failed,
    // which its error workflow turns into a Telegram alert.
    logEvent("error", "casa_negocio.avisos_fallidos", {}, error);
    return NextResponse.json({ ok: false, error: "No se pudieron evaluar los avisos." }, { status: 500 });
  }
}
