/**
 * Calendar helpers for the Casa y Negocio module, always in America/Bogota.
 *
 * HOW DATES ARE STORED. Day-level columns (`fechaPago`, `fechaPrestamo`,
 * `CnMovimiento.fecha`, ...) are written as *local midnight* by processes that
 * run with `TZ=America/Bogota` (docker-compose sets it), e.g. `new Date(2026,
 * 11, 5)` -> `2026-12-05T05:00:00.000Z`. Colombia has had no daylight saving
 * time since 1993, so Bogota is a fixed UTC-5 and "the Bogota day D" is exactly
 * the UTC interval `[D 05:00Z, D+1 05:00Z)`.
 *
 * These helpers compute those instants with `Date.UTC` instead of `new Date(y,
 * m, d)`, so they give the same answer whatever the TZ of the process running
 * them (Vitest on a laptop, a script run from the host, the container).
 *
 * Pure module: no server imports, safe for client components and tests.
 */

/** Bogota is UTC-5 all year round. */
const BOGOTA_OFFSET_HOURS = 5;

/** A month key, `YYYY-MM`. */
export type MesClave = string;

const MES_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Parses `YYYY-MM` into numbers, or null when the text is not a real month. */
export function parseMes(mes: string): { anio: number; mes: number } | null {
  const match = MES_PATTERN.exec(mes.trim());
  if (!match) return null;
  const anio = Number(match[1]);
  // Keep the range sane: the module starts in 2026, a typo like 0202 is noise.
  if (anio < 2000 || anio > 2100) return null;
  return { anio, mes: Number(match[2]) };
}

/** Instant of local midnight in Bogota for the given calendar day (month is 1-12). */
export function bogotaMidnight(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia, BOGOTA_OFFSET_HOURS));
}

/**
 * `[inicio, fin)` of a month in Bogota, as UTC instants ready for a Prisma
 * `gte` / `lt` filter. `fin` is the first instant of the next month.
 */
export function rangoMes(mes: MesClave): { inicio: Date; fin: Date } {
  const parsed = parseMes(mes);
  if (!parsed) throw new RangeError(`rangoMes: "${mes}" no es un mes válido (AAAA-MM).`);
  return {
    inicio: bogotaMidnight(parsed.anio, parsed.mes, 1),
    // Date.UTC normalises month 13 into January of the next year.
    fin: bogotaMidnight(parsed.anio, parsed.mes + 1, 1),
  };
}

/** Calendar parts of an instant as seen in Bogota. */
export function partesBogota(date: Date): { anio: number; mes: number; dia: number } {
  const shifted = new Date(date.getTime() - BOGOTA_OFFSET_HOURS * 3_600_000);
  return { anio: shifted.getUTCFullYear(), mes: shifted.getUTCMonth() + 1, dia: shifted.getUTCDate() };
}

/** `YYYY-MM-DD` of an instant in Bogota: the plain date the UI shows and groups by. */
export function fechaClave(date: Date): string {
  const { anio, mes, dia } = partesBogota(date);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** `YYYY-MM` of an instant in Bogota. */
export function mesClave(date: Date): MesClave {
  return fechaClave(date).slice(0, 7);
}

/** Month key shifted by `delta` months (negative goes back). */
export function sumarMeses(mes: MesClave, delta: number): MesClave {
  const parsed = parseMes(mes);
  if (!parsed) throw new RangeError(`sumarMeses: "${mes}" no es un mes válido (AAAA-MM).`);
  const total = parsed.anio * 12 + (parsed.mes - 1) + delta;
  const anio = Math.floor(total / 12);
  return `${anio}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Number of days of a month (1-12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Due date of a payment day inside a month, clamped to the month's last day
 * (a "día 31" expense falls on 30-nov, 28/29-feb). Returns `YYYY-MM-DD`.
 */
export function fechaDePagoEnMes(mes: MesClave, diaPago: number): string {
  const parsed = parseMes(mes);
  if (!parsed) throw new RangeError(`fechaDePagoEnMes: "${mes}" no es un mes válido (AAAA-MM).`);
  const dia = Math.min(Math.max(1, Math.trunc(diaPago)), diasDelMes(parsed.anio, parsed.mes));
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

/** Whole days from Bogota day `desde` to Bogota day `hasta` (both `YYYY-MM-DD`). */
export function diasEntre(desde: string, hasta: string): number {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(hasta) - toUtc(desde)) / 86_400_000);
}
