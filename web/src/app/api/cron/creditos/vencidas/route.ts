import { NextResponse } from "next/server";

import { actualizarCuotasVencidas } from "@/features/creditos/pagos/vencidas.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CREDITOS_CRON_SECRET;

  if (!expectedSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${expectedSecret}`;
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
