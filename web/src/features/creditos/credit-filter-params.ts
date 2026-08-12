import type { CreditFacetFilters } from "./credit-facets";
import type { SegmentoCreditos } from "./portfolio-summary";

export type RawCreditSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface ParsedCreditFilterParams {
  filters: CreditFacetFilters;
  page: number;
}

/** Parses and sanitizes every URL-backed Credit filter on the server. */
export function parseCreditFilterParams(
  params: RawCreditSearchParams,
): ParsedCreditFilterParams {
  return {
    page: positiveInteger(first(params.page), 1),
    filters: {
      query: first(params.q).trim(),
      segmento: parseSegment(first(params.estado)),
      codigos: stringList(first(params.codigos)),
      clientes: stringList(first(params.clientes)),
      cuotasAtrasadas: nonNegativeIntegerList(first(params.cuotasAtrasadas)),
      montos: numberList(first(params.montos)),
      montoMin: nullableNumber(first(params.montoMin)),
      montoMax: nullableNumber(first(params.montoMax)),
      capitales: numberList(first(params.capitales)),
      capitalMin: nullableNumber(first(params.capitalMin)),
      capitalMax: nullableNumber(first(params.capitalMax)),
      intereses: numberList(first(params.intereses)),
      interesMin: nullableNumber(first(params.interesMin)),
      interesMax: nullableNumber(first(params.interesMax)),
      proximaFechaDesde: nullableDate(first(params.proximaFechaDesde)),
      proximaFechaHasta: nullableDate(first(params.proximaFechaHasta)),
      proximaValorMin: nullableNumber(first(params.proximaValorMin)),
      proximaValorMax: nullableNumber(first(params.proximaValorMax)),
      sinProximaCuota: first(params.sinProximaCuota) === "1",
      tasas: numberList(first(params.tasas)),
      tasaMin: nullableNumber(first(params.tasaMin)),
      tasaMax: nullableNumber(first(params.tasaMax)),
    },
  };
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseSegment(value: string): SegmentoCreditos {
  if (value === "ACTIVO" || value === "VENCIDA" || value === "CANCELADO") {
    return value;
  }
  return "TODOS";
}

function stringList(value: string): string[] {
  if (!value) return [];
  return [...new Set(value.split("|").map(safeDecode).map((item) => item.trim()).filter(Boolean))];
}

function numberList(value: string): number[] {
  return stringList(value).map(Number).filter(Number.isFinite);
}

function nonNegativeIntegerList(value: string): number[] {
  return numberList(value).filter((item) => Number.isInteger(item) && item >= 0);
}

function nullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return null;
  return parsed;
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
