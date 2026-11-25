import { calcularCuentasNegocio } from "./cuentas-mes";
import { compararDias, diferenciaDias, mesDe, sumarMeses } from "./dates";
import type { CreditoCarteraInput, CuotaPendienteInput, DiaISO, MesCobrosInput, MesISO, MesNegocioInput, Pesos } from "./inputs";
import { assertPesos, porcentajeEntero, sumarPesos } from "./money";

/**
 * Resumen (Resumen.dc.html): multi-month views. Each function takes per-month totals the
 * data layer aggregates (one row per month), so the engine never scans raw events here.
 */

// ---------------------------------------------------------------------------
// Ganancia y retiros
// ---------------------------------------------------------------------------

export interface MesGananciaRetiros {
  mes: MesISO;
  ganancia: Pesos;
  retiros: Pesos;
  reinvertido: Pesos;
  /** More went to the house than the business earned: the capital shrank. Strict (equal is not). */
  capitalBajo: boolean;
}

export interface GananciaRetiros {
  meses: MesGananciaRetiros[];
  mesesCapitalBajo: MesISO[];
  /** Sum of the shortfalls of those months, positive ("el capital bajó $ 2,0 M"). */
  capitalPerdido: Pesos;
}

export function calcularGananciaRetiros(meses: readonly MesNegocioInput[]): GananciaRetiros {
  const filas = [...meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(({ mes, negocio }): MesGananciaRetiros => {
      const c = calcularCuentasNegocio(negocio);
      return { mes, ganancia: c.ganancia, retiros: c.retirosCasa, reinvertido: c.reinvertido, capitalBajo: c.reinvertido < 0 };
    });
  const bajos = filas.filter((f) => f.capitalBajo);
  // Negate as 0 − x, not -x: `-0` would leak into equality checks and `Object.is`.
  return { meses: filas, mesesCapitalBajo: bajos.map((f) => f.mes), capitalPerdido: 0 - sumarPesos(bajos.map((f) => f.reinvertido)) };
}

// ---------------------------------------------------------------------------
// Cobros: historial (cumplimiento) + proyección
// ---------------------------------------------------------------------------

export interface MesCumplimiento {
  mes: MesISO;
  cobradoCapital: Pesos;
  cobradoInteres: Pesos;
  cobrado: Pesos;
  /** "Lo que tocaba cobrar". */
  esperado: Pesos;
  /** Floored % of cobrado over esperado; null when nothing was scheduled. Can exceed 100 (prepayments). */
  cumplimiento: number | null;
}

export interface CumplimientoCobros {
  meses: MesCumplimiento[];
  cobrado: Pesos;
  esperado: Pesos;
  /** Over the whole window, weighted by amount ("93 % de lo que tocaba cobrar"). */
  cumplimiento: number | null;
}

export function calcularCumplimientoCobros(meses: readonly MesCobrosInput[]): CumplimientoCobros {
  const filas = [...meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m): MesCumplimiento => {
      const cobrado = assertPesos(m.cobradoCapital, "cobradoCapital") + assertPesos(m.cobradoInteres, "cobradoInteres");
      const esperado = assertPesos(m.esperadoCapital, "esperadoCapital") + assertPesos(m.esperadoInteres, "esperadoInteres");
      return { mes: m.mes, cobradoCapital: m.cobradoCapital, cobradoInteres: m.cobradoInteres, cobrado, esperado, cumplimiento: porcentajeEntero(cobrado, esperado) };
    });
  const cobrado = sumarPesos(filas.map((f) => f.cobrado));
  const esperado = sumarPesos(filas.map((f) => f.esperado));
  return { meses: filas, cobrado, esperado, cumplimiento: porcentajeEntero(cobrado, esperado) };
}

export interface MesProyeccion {
  mes: MesISO;
  capital: Pesos;
  interes: Pesos;
  total: Pesos;
}

export interface ProyeccionCobros {
  meses: MesProyeccion[];
  /** "Viene en 6 meses · si todos pagan a tiempo". */
  total: Pesos;
  /** "De eso, intereses". */
  intereses: Pesos;
}

/**
 * Forward projection: pending cuotas bucketed into the `n` months after `mesActual`
 * (the current month stays on the history side, as in the canvas where HOY sits after Nov).
 * Cuotas outside the window — overdue ones included — are ignored; overdue money is shown
 * by the delinquency buckets instead. Every month in the window is present, even if empty.
 */
export function proyectarCobros(cuotas: readonly CuotaPendienteInput[], mesActual: MesISO, n = 6): ProyeccionCobros {
  const meses: MesProyeccion[] = Array.from({ length: n }, (_, i) => ({ mes: sumarMeses(mesActual, i + 1), capital: 0, interes: 0, total: 0 }));
  const idx = new Map(meses.map((m, i) => [m.mes, i]));
  for (const c of cuotas) {
    const i = idx.get(mesDe(c.fechaProgramada));
    if (i === undefined) continue;
    meses[i].capital += assertPesos(c.capital, "capital");
    meses[i].interes += assertPesos(c.interes, "interes");
  }
  for (const m of meses) m.total = m.capital + m.interes;
  return { meses, total: sumarPesos(meses.map((m) => m.total)), intereses: sumarPesos(meses.map((m) => m.interes)) };
}

// ---------------------------------------------------------------------------
// Tramos de atraso
// ---------------------------------------------------------------------------

export type TramoId = "AL_DIA" | "D1_30" | "D31_60" | "D61_90" | "MAS_90";

export interface TramoAtraso {
  id: TramoId;
  label: string;
  creditos: number;
  saldo: Pesos;
}

const TRAMOS: readonly [TramoId, string][] = [
  ["AL_DIA", "Al día"], ["D1_30", "1 a 30 días"], ["D31_60", "31 a 60 días"], ["D61_90", "61 a 90 días"], ["MAS_90", "Más de 90 días"],
];

/** Days overdue of a credit as of `hoy`: from its oldest unpaid due date; 0 when none or not yet past. */
export function diasAtraso(credito: Pick<CreditoCarteraInput, "cuotaVencidaMasAntigua">, hoy: DiaISO): number {
  if (!credito.cuotaVencidaMasAntigua) return 0;
  return Math.max(0, diferenciaDias(credito.cuotaVencidaMasAntigua, hoy));
}

export function tramoDe(dias: number): TramoId {
  if (dias <= 0) return "AL_DIA";
  if (dias <= 30) return "D1_30";
  if (dias <= 60) return "D31_60";
  if (dias <= 90) return "D61_90";
  return "MAS_90";
}

/**
 * Splits the portfolio by days overdue. Buckets hold the credits' remaining capital, so
 * their sum equals "En la calle". All five buckets are always returned, in display order.
 * Credits with no capital left are skipped (they are settled, not "al día").
 */
export function calcularTramosAtraso(creditos: readonly CreditoCarteraInput[], hoy: DiaISO): TramoAtraso[] {
  const tramos = new Map<TramoId, TramoAtraso>(TRAMOS.map(([id, label]) => [id, { id, label, creditos: 0, saldo: 0 }]));
  for (const c of creditos) {
    if (assertPesos(c.saldoCapital, "saldoCapital") <= 0) continue;
    const t = tramos.get(tramoDe(diasAtraso(c, hoy)))!;
    t.creditos += 1;
    t.saldo += c.saldoCapital;
  }
  return [...tramos.values()];
}

/**
 * Days since a credit last paid, for warning 8. When it never paid, the clock starts at its
 * first scheduled cuota (no payment was expected before that); a credit whose first cuota is
 * still ahead returns 0.
 */
export function diasSinPagos(credito: Pick<CreditoCarteraInput, "ultimoPago" | "primeraCuota">, hoy: DiaISO): number {
  const desde = credito.ultimoPago ?? credito.primeraCuota;
  if (!desde || compararDias(desde, hoy) > 0) return 0;
  return diferenciaDias(desde, hoy);
}
