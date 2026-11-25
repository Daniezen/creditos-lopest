import { compararDias, diaEnMes, mesDe, nombreMes, partesMes } from "./dates";
import type {
  DiaISO,
  GastoFijoInput,
  GastoVariableInput,
  MesISO,
  PagoFijoInput,
  Pesos,
  SobreInput,
} from "./inputs";
import { assertPesos, porcentajeEntero, sumarPesos } from "./money";

// ---------------------------------------------------------------------------
// Fijos
// ---------------------------------------------------------------------------

/**
 * - PAGADO: payments for this occurrence cover the configured amount.
 * - SIN_PAGAR: still owed and its due day is strictly before today ("pasa su fecha"):
 *   the due day itself is still on time.
 * - POR_VENIR: still owed, due today or later.
 * - NO_TOCA: an annual expense whose month is not this one.
 */
export type EstadoFijo = "PAGADO" | "SIN_PAGAR" | "POR_VENIR" | "NO_TOCA";

export interface FijoDelMes {
  id: string;
  nombre: string;
  periodicidad: GastoFijoInput["periodicidad"];
  estado: EstadoFijo;
  /** Configured amount of one occurrence. */
  monto: Pesos;
  /** Paid towards this month's occurrence (may exceed `monto`). */
  pagado: Pesos;
  /** Still owed for this month: max(0, monto − pagado); 0 for NO_TOCA. */
  pendiente: Pesos;
  /** Due day in this month (clamped), or null for NO_TOCA. */
  vence: DiaISO | null;
  /** Latest payment day for this occurrence, when any. */
  pagadoEl: DiaISO | null;
  /** Month name an annual expense belongs to ("junio"), for "En junio". */
  mesQueToca: string | null;
}

/** Whether a fixed expense has an occurrence in `mes`. Annual ones count only in their month. */
export function fijoTocaEnMes(fijo: GastoFijoInput, mes: MesISO): boolean {
  if (fijo.periodicidad === "MENSUAL") return true;
  if (!fijo.mesAnual || fijo.mesAnual < 1 || fijo.mesAnual > 12) {
    throw new RangeError(`El gasto anual ${fijo.id} necesita mesAnual entre 1 y 12`);
  }
  return partesMes(mes).mes === fijo.mesAnual;
}

/**
 * Status of every configured fixed expense for `mes`, as of `hoy`.
 * `pagos` may contain any month: only those settling `mes` (by `mes` or by `fecha`) apply.
 */
export function calcularFijosDelMes(
  fijos: readonly GastoFijoInput[],
  pagos: readonly PagoFijoInput[],
  mes: MesISO,
  hoy: DiaISO,
): FijoDelMes[] {
  return fijos.map((fijo) => {
    assertPesos(fijo.monto, `monto de ${fijo.nombre}`);
    const mesQueToca = fijo.periodicidad === "ANUAL" && fijo.mesAnual ? nombreMes(`2000-${String(fijo.mesAnual).padStart(2, "0")}`) : null;
    if (!fijoTocaEnMes(fijo, mes)) {
      return { id: fijo.id, nombre: fijo.nombre, periodicidad: fijo.periodicidad, estado: "NO_TOCA", monto: fijo.monto, pagado: 0, pendiente: 0, vence: null, pagadoEl: null, mesQueToca };
    }
    const propios = pagos.filter((p) => p.gastoId === fijo.id && (p.mes ?? mesDe(p.fecha)) === mes);
    const pagado = sumarPesos(propios.map((p) => p.monto), `pago de ${fijo.nombre}`);
    const pagadoEl = propios.reduce<DiaISO | null>((max, p) => (max === null || compararDias(p.fecha, max) > 0 ? p.fecha : max), null);
    const vence = diaEnMes(mes, fijo.diaPago);
    const pendiente = Math.max(0, fijo.monto - pagado);
    // A 0-amount fijo ("Sin monto" in Configuración) owes nothing: it is never SIN_PAGAR (that
    // would raise warning 1 for no money) and reads PAGADO only once something was paid.
    const estado: EstadoFijo =
      pagado > 0 && pendiente === 0
        ? "PAGADO"
        : pendiente > 0 && compararDias(vence, hoy) < 0
          ? "SIN_PAGAR"
          : "POR_VENIR";
    return { id: fijo.id, nombre: fijo.nombre, periodicidad: fijo.periodicidad, estado, monto: fijo.monto, pagado, pendiente, vence, pagadoEl, mesQueToca };
  });
}

/**
 * Cash spent on fixed expenses in `mes`: payments whose `fecha` is inside the month,
 * regardless of which occurrence they settle (the casa equation is a cash view).
 */
export function gastadoEnFijos(pagos: readonly PagoFijoInput[], mes: MesISO): Pesos {
  return sumarPesos(pagos.filter((p) => mesDe(p.fecha) === mes).map((p) => p.monto), "pago fijo");
}

/** What is still owed this month across fijos ("Fijos sin pagar"), overdue and upcoming alike. */
export function fijosSinPagar(fijos: readonly FijoDelMes[]): Pesos {
  return sumarPesos(fijos.map((f) => f.pendiente));
}

// ---------------------------------------------------------------------------
// Sobres
// ---------------------------------------------------------------------------

/**
 * - NORMAL: below the warning threshold.
 * - CERCA: at or above `umbral` % of the cap but not over it (Gasolina 186.000/200.000 = 93 %).
 * - PASADO: spent strictly more than the cap (reaching exactly 100 % is CERCA, not PASADO).
 */
export type NivelSobre = "NORMAL" | "CERCA" | "PASADO";

export interface SobreDelMes {
  id: string;
  nombre: string;
  tope: Pesos;
  gastado: Pesos;
  /** tope − gastado; negative when over the cap. */
  queda: Pesos;
  /** Floored share of the cap; null when the cap is 0. */
  porcentaje: number | null;
  nivel: NivelSobre;
}

export interface SobresDelMes {
  sobres: SobreDelMes[];
  /** Sum of caps ("de $ 4.070.000"). */
  topeTotal: Pesos;
  /** Every variable expense in the month, with or without envelope (casa "Variables"). */
  gastadoTotal: Pesos;
  /** topeTotal − spent inside envelopes: the canvas "Quedan $ 2.130.000". Can be negative. */
  quedaTotal: Pesos;
  /** Variable spending that has no envelope (counts in gastadoTotal, not in quedaTotal). */
  sinSobre: Pesos;
}

/**
 * Per-envelope spending for `mes`. The CERCA cut uses integer math
 * (`gastado × 100 ≥ umbral × tope`) so 89.99 % never rounds into a warning.
 * `umbralCerca` is the configurable threshold of warning rule 2 (default 90).
 */
export function calcularSobresDelMes(
  sobres: readonly SobreInput[],
  gastos: readonly GastoVariableInput[],
  mes: MesISO,
  umbralCerca = 90,
): SobresDelMes {
  const delMes = gastos.filter((g) => mesDe(g.fecha) === mes);
  const ids = new Set(sobres.map((s) => s.id));
  const resultado = sobres.map((s): SobreDelMes => {
    assertPesos(s.tope, `tope de ${s.nombre}`);
    const gastado = sumarPesos(delMes.filter((g) => g.sobreId === s.id).map((g) => g.monto), `gasto de ${s.nombre}`);
    const nivel: NivelSobre =
      gastado > s.tope ? "PASADO" : s.tope > 0 && gastado * 100 >= umbralCerca * s.tope ? "CERCA" : "NORMAL";
    return { id: s.id, nombre: s.nombre, tope: s.tope, gastado, queda: s.tope - gastado, porcentaje: porcentajeEntero(gastado, s.tope), nivel };
  });
  // Expenses pointing at an unknown/archived envelope are treated as "sin sobre" so they still
  // reduce the casa balance instead of vanishing.
  const sinSobre = sumarPesos(delMes.filter((g) => g.sobreId === null || !ids.has(g.sobreId)).map((g) => g.monto));
  const topeTotal = sumarPesos(resultado.map((s) => s.tope));
  const enSobres = sumarPesos(resultado.map((s) => s.gastado));
  return { sobres: resultado, topeTotal, gastadoTotal: enSobres + sinSobre, quedaTotal: topeTotal - enSobres, sinSobre };
}
