/**
 * Health report vocabulary and evaluation for `GET /api/salud`.
 *
 * This module is pure: it receives what the queries measured and decides the
 * overall state and HTTP status. Keeping the decision here (and the I/O in
 * `health-queries.ts`) lets Vitest cover every branch without a database.
 *
 * The route is PUBLIC (n8n and uptime probes call it without a session), so the
 * report may only contain aggregate, non-sensitive values: booleans, counts,
 * durations, timestamps and a commit hash. Never identifiers, names, amounts,
 * URLs, error messages or environment values. `HEALTH_REPORT_KEYS` pins the
 * exact shape and a test fails if a new field appears without review.
 */

/**
 * - `ok`: everything measured is within thresholds.
 * - `degradado`: the app answers and the database is up, but a scheduled job
 *   looks late. HTTP 200, because the app itself serves traffic; n8n still
 *   alerts on it.
 * - `caido`: the database does not answer. HTTP 503.
 */
export type HealthState = "ok" | "degradado" | "caido";

/** Database round-trip budget. Short on purpose: a probe must not hang. */
export const DB_TIMEOUT_MS = 2_000;

/**
 * Overdue installments still PENDIENTE are tolerated for one extra day past the
 * cron cutoff. Right after midnight new installments cross the cutoff before
 * the early-morning cron runs; only a backlog older than a full cycle means the
 * cron did not run.
 */
export const OVERDUE_BACKLOG_TOLERANCE_DAYS = 1;

/**
 * Maximum age of the latest Drive verification before the reconciliation cron
 * is considered late. The schedule lives in n8n, not in this repo, so the
 * threshold is deliberately generous; tighten it once the schedule is fixed.
 */
export const DRIVE_MAX_AGE_HOURS = 7 * 24;

export interface HealthMeasurements {
  database: { ok: boolean; latencyMs: number };
  /** `null` when the database is down and the cron queries were skipped. */
  vencidas: {
    /** PENDIENTE installments already past the cron cutoff (strict). */
    pendientesVencidas: number;
    /** Same, but past the cutoff by more than the tolerance: the cron is late. */
    pendientesVencidasFueraDeTolerancia: number;
    /** Latest `actualizadoEn` of an installment the cron transitioned (`accionPor = 'cron'`). */
    ultimaTransicionCron: Date | null;
  } | null;
  drive: {
    /** Latest `DocumentoCliente.driveUltimaVerificacion` (cron or upload). */
    ultimaVerificacion: Date | null;
  } | null;
  version: { commit: string | null; buildTime: string | null };
}

export interface HealthReport {
  estado: HealthState;
  ts: string;
  version: { commit: string | null; buildTime: string | null };
  baseDeDatos: { ok: boolean; latenciaMs: number };
  crons: {
    vencidas: {
      ok: boolean | null;
      pendientesVencidas: number | null;
      pendientesVencidasFueraDeTolerancia: number | null;
      ultimaTransicion: string | null;
    };
    driveSincronizacion: {
      ok: boolean | null;
      ultimaVerificacion: string | null;
      horasDesdeUltimaVerificacion: number | null;
    };
  };
}

/** Exact, reviewed shape of the public body (dot paths). */
export const HEALTH_REPORT_KEYS = [
  "estado",
  "ts",
  "version.commit",
  "version.buildTime",
  "baseDeDatos.ok",
  "baseDeDatos.latenciaMs",
  "crons.vencidas.ok",
  "crons.vencidas.pendientesVencidas",
  "crons.vencidas.pendientesVencidasFueraDeTolerancia",
  "crons.vencidas.ultimaTransicion",
  "crons.driveSincronizacion.ok",
  "crons.driveSincronizacion.ultimaVerificacion",
  "crons.driveSincronizacion.horasDesdeUltimaVerificacion",
] as const;

const COMMIT_SHAPE = /^[0-9a-f]{7,40}$/i;
const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

/**
 * Reads build metadata from the environment, accepting only values with the
 * expected shape. Anything else becomes `null`, so a misconfigured variable can
 * never leak arbitrary text through the public endpoint.
 */
export function readVersion(env: Record<string, string | undefined>): HealthMeasurements["version"] {
  const commit = env.APP_COMMIT_SHA?.trim();
  const buildTime = env.APP_BUILD_TIME?.trim();
  return {
    commit: commit && COMMIT_SHAPE.test(commit) ? commit.toLowerCase() : null,
    buildTime: buildTime && ISO_SHAPE.test(buildTime) ? buildTime : null,
  };
}

/** Turns measurements into the public report plus its HTTP status. */
export function evaluateHealth(m: HealthMeasurements, now: Date = new Date()): { status: 200 | 503; report: HealthReport } {
  const vencidasOk = m.vencidas ? m.vencidas.pendientesVencidasFueraDeTolerancia === 0 : null;

  const driveAgeHours =
    m.drive?.ultimaVerificacion != null
      ? Math.floor((now.getTime() - m.drive.ultimaVerificacion.getTime()) / 3_600_000)
      : null;
  // No verification at all yet (fresh install without documents) is not a
  // failure: there is nothing to reconcile.
  const driveOk = m.drive ? driveAgeHours === null || driveAgeHours <= DRIVE_MAX_AGE_HOURS : null;

  const estado: HealthState = !m.database.ok ? "caido" : vencidasOk === false || driveOk === false ? "degradado" : "ok";

  return {
    status: estado === "caido" ? 503 : 200,
    report: {
      estado,
      ts: now.toISOString(),
      version: m.version,
      baseDeDatos: { ok: m.database.ok, latenciaMs: m.database.latencyMs },
      crons: {
        vencidas: {
          ok: vencidasOk,
          pendientesVencidas: m.vencidas?.pendientesVencidas ?? null,
          pendientesVencidasFueraDeTolerancia: m.vencidas?.pendientesVencidasFueraDeTolerancia ?? null,
          ultimaTransicion: m.vencidas?.ultimaTransicionCron?.toISOString() ?? null,
        },
        driveSincronizacion: {
          ok: driveOk,
          ultimaVerificacion: m.drive?.ultimaVerificacion?.toISOString() ?? null,
          horasDesdeUltimaVerificacion: driveAgeHours,
        },
      },
    },
  };
}

/**
 * Rejects after `ms` milliseconds. Used to bound every database call made by
 * the probe; the underlying query is not cancelled, but the response is.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
