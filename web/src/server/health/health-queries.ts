import { EstadoEventoFinanciero, TipoEventoFinanciero } from "@prisma/client";

import { obtenerCorteExclusivoCuotasVencidas } from "@/features/creditos/pagos/overdue-policy";
import { obtenerHoyColombia } from "@/features/creditos/pagos/vencidas.service";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/server/observability/log";

import {
  DB_TIMEOUT_MS,
  OVERDUE_BACKLOG_TOLERANCE_DAYS,
  readVersion,
  withTimeout,
  type HealthMeasurements,
} from "./health-report";

/**
 * Database reads behind `GET /api/salud`. Every query is aggregate (`count`,
 * `max`) so no row, identifier or amount ever reaches the route.
 *
 * How the cron state is inferred (neither cron writes a run log yet):
 * - Overdue cron (`/api/cron/creditos/vencidas`): it moves PENDIENTE
 *   installments past the cutoff to ATRASADO. So the backlog of PENDIENTE
 *   installments past that same cutoff is a direct measurement: after a run it
 *   is zero. `accionPor = 'cron'` additionally dates the last transition, but
 *   a later payment overwrites `accionPor`, so it is informative only.
 * - Drive cron (`/api/cron/documentos/sincronizar`): every verified file gets
 *   `driveUltimaVerificacion`, so its maximum dates the latest reconciliation
 *   (cron or the post-upload one).
 */

async function pingDatabase(): Promise<HealthMeasurements["database"]> {
  const started = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    logEvent("error", "salud.base_de_datos_no_responde", { latenciaMs: Date.now() - started }, error);
    return { ok: false, latencyMs: Date.now() - started };
  }
}

async function measureOverdueCron(): Promise<HealthMeasurements["vencidas"]> {
  // Same cutoff as the cron itself, so "pending past cutoff" means exactly
  // "what the next cron run would transition".
  const corte = obtenerCorteExclusivoCuotasVencidas(obtenerHoyColombia());
  const corteTolerado = new Date(corte);
  corteTolerado.setDate(corteTolerado.getDate() - OVERDUE_BACKLOG_TOLERANCE_DAYS);

  const pendingPastCutoff = (lt: Date) =>
    prisma.eventoFinanciero.count({
      where: {
        tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
        estado: EstadoEventoFinanciero.PENDIENTE,
        fechaProgramada: { lt },
        credito: { eliminadoEn: null },
      },
    });

  const [pendientesVencidas, pendientesVencidasFueraDeTolerancia, ultima] = await withTimeout(
    Promise.all([
      pendingPastCutoff(corte),
      pendingPastCutoff(corteTolerado),
      prisma.eventoFinanciero.aggregate({ _max: { actualizadoEn: true }, where: { accionPor: "cron" } }),
    ]),
    DB_TIMEOUT_MS,
  );

  return { pendientesVencidas, pendientesVencidasFueraDeTolerancia, ultimaTransicionCron: ultima._max.actualizadoEn };
}

async function measureDriveCron(): Promise<HealthMeasurements["drive"]> {
  const result = await withTimeout(
    prisma.documentoCliente.aggregate({ _max: { driveUltimaVerificacion: true } }),
    DB_TIMEOUT_MS,
  );
  return { ultimaVerificacion: result._max.driveUltimaVerificacion };
}

/**
 * Collects every measurement. Cron queries only run when the ping succeeded;
 * if one of them fails on its own, its section is reported as unknown (`null`)
 * rather than failing the whole probe.
 */
export async function collectHealthMeasurements(): Promise<HealthMeasurements> {
  const version = readVersion(process.env);
  const database = await pingDatabase();
  if (!database.ok) return { database, vencidas: null, drive: null, version };

  const [vencidas, drive] = await Promise.all([
    measureOverdueCron().catch((error: unknown) => {
      logEvent("warn", "salud.medicion_vencidas_fallida", {}, error);
      return null;
    }),
    measureDriveCron().catch((error: unknown) => {
      logEvent("warn", "salud.medicion_drive_fallida", {}, error);
      return null;
    }),
  ]);

  return { database, vencidas, drive, version };
}
