import { NextResponse } from "next/server";

import { collectHealthMeasurements } from "@/server/health/health-queries";
import { evaluateHealth } from "@/server/health/health-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public health probe used by the n8n workflow "LOPEST - Salud diaria" and by
 * any uptime monitor.
 *
 * - 200: database answers (`estado` is `ok` or `degradado`).
 * - 503: database does not answer within `DB_TIMEOUT_MS` (`estado: caido`).
 *
 * The body contains aggregate values only (see `HEALTH_REPORT_KEYS`); it never
 * echoes errors, identifiers or environment values, because the route needs no
 * session. Details of a failure go to the structured log instead.
 */
export async function GET() {
  const { status, report } = evaluateHealth(await collectHealthMeasurements());
  return NextResponse.json(report, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
