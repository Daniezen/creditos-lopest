import type { CreditoResumenFuente, SegmentoCreditos } from "./portfolio-summary";
import { derivarCreditoOperativo } from "./portfolio-summary";

export type CreditFacet =
  | "codigo"
  | "cliente"
  | "cuotasAtrasadas"
  | "monto"
  | "capital"
  | "interes"
  | "proximaCuota"
  | "tasa";

export interface CreditFacetFilters {
  query: string;
  segmento: SegmentoCreditos;
  codigos: string[];
  clientes: string[];
  cuotasAtrasadas: number[];
  montos: number[];
  montoMin: number | null;
  montoMax: number | null;
  capitales: number[];
  capitalMin: number | null;
  capitalMax: number | null;
  intereses: number[];
  interesMin: number | null;
  interesMax: number | null;
  proximaFechaDesde: Date | null;
  proximaFechaHasta: Date | null;
  proximaValorMin: number | null;
  proximaValorMax: number | null;
  sinProximaCuota: boolean;
  tasas: number[];
  tasaMin: number | null;
  tasaMax: number | null;
}

export interface CreditFacetSource extends CreditoResumenFuente {
  creadoEn: Date;
  fechaPrestamo: Date;
  plazoMeses: number;
  tasaMensual: number;
  frecuencia: string;
  tipoAmortizacion: string;
  cliente: {
    id: string;
    cedula: string;
    nombre: string;
    telefono: string | null;
  };
}

export interface CreditFacetCatalogs {
  codigos: string[];
  clientes: Array<{ id: string; nombre: string; cedula: string }>;
  cuotasAtrasadas: number[];
  montos: number[];
  capitales: number[];
  intereses: number[];
  tasas: number[];
  proximaCuota: {
    fechaMin: Date | null;
    fechaMax: Date | null;
    valorMin: number | null;
    valorMax: number | null;
    incluyeSinProximaCuota: boolean;
  };
}

export function matchesCreditFilters(
  credit: CreditFacetSource,
  filters: CreditFacetFilters,
  omittedFacet?: CreditFacet,
): boolean {
  const derived = derivarCreditoOperativo(credit);
  const normalizedQuery = normalize(filters.query);

  if (normalizedQuery) {
    const searchable = normalize([
      credit.codigo,
      credit.cliente.nombre,
      credit.cliente.cedula,
      credit.cliente.telefono ?? "",
    ].join(" "));
    if (!searchable.includes(normalizedQuery)) return false;
  }

  if (filters.segmento === "ACTIVO" && credit.estado !== "ACTIVO") return false;
  if (filters.segmento === "CANCELADO" && credit.estado !== "CANCELADO") return false;
  if (filters.segmento === "VENCIDA" && (credit.estado !== "ACTIVO" || !derived.tieneCuotasVencidas)) return false;

  if (omittedFacet !== "codigo" && filters.codigos.length && !filters.codigos.includes(credit.codigo)) return false;
  if (omittedFacet !== "cliente" && filters.clientes.length && !filters.clientes.includes(credit.cliente.id)) return false;
  if (omittedFacet !== "cuotasAtrasadas" && filters.cuotasAtrasadas.length && !filters.cuotasAtrasadas.includes(derived.cuotasAtrasadas)) return false;
  if (omittedFacet !== "monto" && !matchesNumeric(credit.monto, filters.montos, filters.montoMin, filters.montoMax)) return false;
  if (omittedFacet !== "capital" && !matchesNumeric(derived.saldoCapital, filters.capitales, filters.capitalMin, filters.capitalMax)) return false;
  if (omittedFacet !== "interes" && !matchesNumeric(derived.interesPendiente, filters.intereses, filters.interesMin, filters.interesMax)) return false;
  if (omittedFacet !== "tasa" && !matchesNumeric(credit.tasaMensual, filters.tasas, filters.tasaMin, filters.tasaMax)) return false;

  if (omittedFacet !== "proximaCuota") {
    const installment = derived.proximaCuota;
    if (filters.sinProximaCuota && installment !== null) return false;
    if (!filters.sinProximaCuota && hasInstallmentRange(filters)) {
      if (!installment) return false;
      if (!matchesDate(installment.fechaProgramada, filters.proximaFechaDesde, filters.proximaFechaHasta)) return false;
      if (!matchesRange(installment.valorProgramado, filters.proximaValorMin, filters.proximaValorMax)) return false;
    }
  }

  return true;
}

export function buildCreditFacetCatalogs(
  credits: CreditFacetSource[],
  filters: CreditFacetFilters,
): CreditFacetCatalogs {
  const forFacet = (facet: CreditFacet) =>
    credits.filter((credit) => matchesCreditFilters(credit, filters, facet));

  const codeSources = forFacet("codigo");
  const clientSources = forFacet("cliente");
  const overdueCountSources = forFacet("cuotasAtrasadas");
  const amountSources = forFacet("monto");
  const capitalSources = forFacet("capital");
  const interestSources = forFacet("interes");
  const rateSources = forFacet("tasa");
  const installmentSources = forFacet("proximaCuota")
    .map((credit) => derivarCreditoOperativo(credit).proximaCuota);
  const installments = installmentSources.filter((value) => value !== null);

  return {
    codigos: uniqueStrings([...codeSources.map((credit) => credit.codigo), ...filters.codigos]),
    clientes: uniqueClients([
      ...clientSources.map((credit) => credit.cliente),
      ...credits.filter((credit) => filters.clientes.includes(credit.cliente.id)).map((credit) => credit.cliente),
    ]),
    cuotasAtrasadas: uniqueNumbers([
      ...overdueCountSources.map((credit) => derivarCreditoOperativo(credit).cuotasAtrasadas),
      ...filters.cuotasAtrasadas,
    ]),
    montos: uniqueNumbers([...amountSources.map((credit) => credit.monto), ...filters.montos]),
    capitales: uniqueNumbers([...capitalSources.map((credit) => derivarCreditoOperativo(credit).saldoCapital), ...filters.capitales]),
    intereses: uniqueNumbers([...interestSources.map((credit) => derivarCreditoOperativo(credit).interesPendiente), ...filters.intereses]),
    tasas: uniqueNumbers([...rateSources.map((credit) => credit.tasaMensual), ...filters.tasas]),
    proximaCuota: {
      fechaMin: minDate(installments.map((value) => value.fechaProgramada)),
      fechaMax: maxDate(installments.map((value) => value.fechaProgramada)),
      valorMin: minNumber(installments.map((value) => value.valorProgramado)),
      valorMax: maxNumber(installments.map((value) => value.valorProgramado)),
      incluyeSinProximaCuota: installmentSources.some((value) => value === null),
    },
  };
}

function matchesNumeric(value: number, exact: number[], min: number | null, max: number | null): boolean {
  if (exact.length && !exact.includes(value)) return false;
  return matchesRange(value, min, max);
}

function matchesRange(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max);
}

function matchesDate(value: Date, min: Date | null, max: Date | null): boolean {
  const time = value.getTime();
  return (min === null || time >= min.getTime()) && (max === null || time <= endOfDay(max).getTime());
}

function hasInstallmentRange(filters: CreditFacetFilters): boolean {
  return filters.proximaFechaDesde !== null || filters.proximaFechaHasta !== null || filters.proximaValorMin !== null || filters.proximaValorMax !== null;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "es"));
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))].sort((left, right) => left - right);
}

function uniqueClients(values: Array<{ id: string; nombre: string; cedula: string }>) {
  return [...new Map(values.map((value) => [value.id, { id: value.id, nombre: value.nombre, cedula: value.cedula }])).values()]
    .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
}

function minDate(values: Date[]): Date | null {
  return values.length ? new Date(Math.min(...values.map((value) => value.getTime()))) : null;
}
function maxDate(values: Date[]): Date | null {
  return values.length ? new Date(Math.max(...values.map((value) => value.getTime()))) : null;
}
function minNumber(values: number[]): number | null { return values.length ? Math.min(...values) : null; }
function maxNumber(values: number[]): number | null { return values.length ? Math.max(...values) : null; }
function endOfDay(value: Date): Date { const result = new Date(value); result.setHours(23, 59, 59, 999); return result; }
