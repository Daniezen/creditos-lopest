import { NextResponse } from "next/server";

import { parseCreditFilterParams } from "@/features/creditos/credit-filter-params";
import { generarReporteExcelCreditos } from "@/features/creditos/credit-export-query";
import { requireUser } from "@/server/auth/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const { filters } = parseCreditFilterParams(raw);
    const report = await generarReporteExcelCreditos(filters, user.nombre || user.email);
    return new Response(new Uint8Array(report.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${report.fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[credit-results-export]", error);
    return NextResponse.json({ ok: false, error: "No se pudo exportar los resultados de créditos." }, { status: 500 });
  }
}
