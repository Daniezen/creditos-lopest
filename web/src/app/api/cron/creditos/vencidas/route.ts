import { NextResponse } from "next/server";

import { actualizarCuotasVencidas } from "@/features/creditos/pagos/vencidas.service";
import { prisma } from "@/lib/prisma";
import { readBearerToken, secretsMatch } from "@/server/security/cron-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time check of `Authorization: Bearer <CREDITOS_CRON_SECRET>`. */
function isAuthorized(request: Request): boolean {
  return secretsMatch(
    readBearerToken(request.headers.get("authorization")),
    process.env.CREDITOS_CRON_SECRET,
  );
}

/**
 * Endpoint interno para actualizar cuotas vencidas.
 *
 * Uso recomendado:
 * - n8n ejecuta GET diario en la madrugada.
 * - Header: Authorization: Bearer <CREDITOS_CRON_SECRET>
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    return actualizarCuotasVencidas(tx);
  });

  return NextResponse.json({
    ok: true,
    updated,
  });
}
