import type { DiaISO, MesISO } from "./inputs";

/**
 * Calendar helpers on `YYYY-MM-DD` / `YYYY-MM` keys.
 *
 * Arithmetic goes through `Date.UTC`, which has no DST and no local offset, so a day key
 * always maps to exactly one UTC midnight and day differences are exact integers. The only
 * place a real instant is interpreted is `diaBogota`, which pins America/Bogota explicitly.
 */

const DIA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES_RE = /^(\d{4})-(\d{2})$/;
const MS_DIA = 86_400_000;

export const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export interface PartesDia { anio: number; mes: number; dia: number }

/** Parses and validates a day key; rejects impossible dates such as 2026-02-30. */
export function partesDia(dia: DiaISO): PartesDia {
  const m = DIA_RE.exec(dia);
  if (!m) throw new RangeError(`Día inválido: ${dia}`);
  const anio = Number(m[1]), mes = Number(m[2]), d = Number(m[3]);
  if (mes < 1 || mes > 12 || d < 1 || d > diasEnMes(`${m[1]}-${m[2]}`)) {
    throw new RangeError(`Día inválido: ${dia}`);
  }
  return { anio, mes, dia: d };
}

export function partesMes(mes: MesISO): { anio: number; mes: number } {
  const m = MES_RE.exec(mes);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new RangeError(`Mes inválido: ${mes}`);
  return { anio: Number(m[1]), mes: Number(m[2]) };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function aMes(anio: number, mes: number): MesISO {
  return `${anio}-${pad(mes)}`;
}

export function aDia(anio: number, mes: number, dia: number): DiaISO {
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

/** Number of days in a month, leap years included (day 0 of next month = last day). */
export function diasEnMes(mes: MesISO): number {
  const { anio, mes: m } = partesMes(mes);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
}

/** Month a day belongs to (string slice, after validation). */
export function mesDe(dia: DiaISO): MesISO {
  partesDia(dia);
  return dia.slice(0, 7);
}

export function diaDelMes(dia: DiaISO): number {
  return partesDia(dia).dia;
}

export function ultimoDia(mes: MesISO): DiaISO {
  const { anio, mes: m } = partesMes(mes);
  return aDia(anio, m, diasEnMes(mes));
}

/**
 * Day `n` of a month, clamped to its last day: a fijo due on the 31st falls on Nov 30
 * and Feb 28/29 instead of disappearing.
 */
export function diaEnMes(mes: MesISO, n: number): DiaISO {
  const { anio, mes: m } = partesMes(mes);
  return aDia(anio, m, Math.min(Math.max(1, Math.trunc(n)), diasEnMes(mes)));
}

/** Whole days from `desde` to `hasta` (positive when `hasta` is later). */
export function diferenciaDias(desde: DiaISO, hasta: DiaISO): number {
  const a = partesDia(desde), b = partesDia(hasta);
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / MS_DIA);
}

/** Shifts a month key by `n` months (negative goes back). */
export function sumarMeses(mes: MesISO, n: number): MesISO {
  const { anio, mes: m } = partesMes(mes);
  const total = anio * 12 + (m - 1) + n;
  return aMes(Math.floor(total / 12), (total % 12 + 12) % 12 + 1);
}

/** Lexicographic order of zero-padded keys equals chronological order. */
export function compararDias(a: DiaISO, b: DiaISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Resolves an instant to its calendar day in America/Bogota. This is the bridge the data
 * layer uses for `EventoFinanciero.fechaPago` and similar timestamps; `en-CA` formats as
 * `YYYY-MM-DD`, which is exactly a `DiaISO`.
 */
export function diaBogota(instante: Date): DiaISO {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function nombreMes(mes: MesISO): string {
  return NOMBRES_MES[partesMes(mes).mes - 1];
}
