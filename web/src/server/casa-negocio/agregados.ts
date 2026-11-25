/**
 * Pure aggregations behind `queries.ts`: delinquency buckets, per-category
 * month figures and the month-by-month history. No database, no Prisma
 * runtime: plain inputs in, plain contract types out, unit-tested directly.
 */
import type {
  CategoriaMes,
  HistorialMes,
  Periodicidad,
  TipoCuenta,
  TipoMovimiento,
  TramoAtraso,
} from "@/features/casa-negocio/types";
import { diasDelMes, fechaDePagoEnMes, parseMes, sumarMeses } from "@/features/casa-negocio/mes";

import { aCentavos, aPesos, type Monetario } from "./dinero";

/** Bucket of a loan by its worst days past due. */
export function tramoDe(diasAtraso: number): TramoAtraso {
  if (diasAtraso <= 0) return "AL_DIA";
  if (diasAtraso <= 30) return "1_30";
  if (diasAtraso <= 60) return "31_60";
  if (diasAtraso <= 90) return "61_90";
  return "MAS_90";
}

export const TRAMOS: readonly TramoAtraso[] = ["AL_DIA", "1_30", "31_60", "61_90", "MAS_90"];

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface CategoriaBase {
  periodicidad: Periodicidad;
  mesAnual: number | null;
  diaPago: number | null;
}

/** Whether a category falls due in a month, and on which day. */
export function vencimientoEnMes(cat: CategoriaBase, mes: string): { venceEnMes: boolean; fechaPagoMes: string | null } {
  const parsed = parseMes(mes);
  if (!parsed) throw new RangeError(`vencimientoEnMes: "${mes}" no es un mes válido.`);
  const venceEnMes = cat.periodicidad === "MENSUAL" || cat.mesAnual === parsed.mes;
  if (!venceEnMes) return { venceEnMes, fechaPagoMes: null };
  // An annual expense without a day is due "some day" of its month: the last
  // day is the latest it can be paid on time.
  const dia = cat.diaPago ?? (cat.periodicidad === "ANUAL" ? diasDelMes(parsed.anio, parsed.mes) : null);
  return { venceEnMes, fechaPagoMes: dia === null ? null : fechaDePagoEnMes(mes, dia) };
}

/**
 * Next due day on or after `hoy` (`YYYY-MM-DD`), looking up to a year ahead.
 * Null for monthly categories without a due day (variable "sobres").
 */
export function proximoVencimiento(cat: CategoriaBase, hoy: string): string | null {
  if (cat.periodicidad === "MENSUAL" && cat.diaPago === null) return null;
  const mesHoy = hoy.slice(0, 7);
  for (let i = 0; i <= 12; i += 1) {
    const mes = sumarMeses(mesHoy, i);
    const { fechaPagoMes } = vencimientoEnMes(cat, mes);
    if (fechaPagoMes && fechaPagoMes >= hoy) return fechaPagoMes;
  }
  return null;
}

/** Fills the month figures of a category from the month's movements. */
export function categoriaDelMes<T extends CategoriaBase>(
  cat: T,
  mes: string,
  hoy: string,
  montosMes: readonly Monetario[],
): Pick<CategoriaMes, "gastadoMes" | "movimientosMes" | "venceEnMes" | "fechaPagoMes" | "pagadoMes" | "proximoVencimiento"> {
  const gastado = montosMes.reduce<number>((total, monto) => total + aCentavos(monto), 0);
  return {
    gastadoMes: aPesos(gastado),
    movimientosMes: montosMes.length,
    ...vencimientoEnMes(cat, mes),
    pagadoMes: gastado > 0,
    proximoVencimiento: proximoVencimiento(cat, hoy),
  };
}

// ---------------------------------------------------------------------------
// Month-by-month history
// ---------------------------------------------------------------------------

export interface HechoCobro {
  mes: string;
  capital: number;
  interes: number;
  total: number;
}

export interface HechoMovimiento {
  mes: string;
  tipo: TipoMovimiento;
  monto: Monetario;
  tipoOrigen: TipoCuenta | null;
  tipoDestino: TipoCuenta | null;
}

export interface HechoMonto {
  mes: string;
  monto: Monetario;
}

type Acumulado = { [K in Exclude<keyof HistorialMes, "mes">]: number };

function vacio(): Acumulado {
  return {
    capitalCobrado: 0,
    interesCobrado: 0,
    totalCobrado: 0,
    desembolsado: 0,
    gastosNegocio: 0,
    aportes: 0,
    retirosCasa: 0,
    perdidas: 0,
    ingresosCasa: 0,
    gastosFijos: 0,
    gastosVariables: 0,
    depositosAhorro: 0,
    retirosAhorro: 0,
  };
}

/**
 * Twelve (or `meses`) months ending at `hasta`, oldest first, with every
 * figure summed in cents. Facts outside the window are ignored.
 */
export function construirHistorial(
  hasta: string,
  hechos: {
    cobros: readonly HechoCobro[];
    desembolsos: readonly HechoMonto[];
    movimientos: readonly HechoMovimiento[];
    castigos: readonly HechoMonto[];
  },
  meses = 12,
): HistorialMes[] {
  const claves = Array.from({ length: meses }, (_, i) => sumarMeses(hasta, i - meses + 1));
  const porMes = new Map<string, Acumulado>(claves.map((mes) => [mes, vacio()]));
  const sumar = (mes: string, campo: keyof Acumulado, monto: Monetario) => {
    const fila = porMes.get(mes);
    if (fila) fila[campo] += aCentavos(monto);
  };

  for (const c of hechos.cobros) {
    sumar(c.mes, "capitalCobrado", c.capital);
    sumar(c.mes, "interesCobrado", c.interes);
    sumar(c.mes, "totalCobrado", c.total);
  }
  for (const d of hechos.desembolsos) sumar(d.mes, "desembolsado", d.monto);
  for (const p of hechos.castigos) sumar(p.mes, "perdidas", p.monto);
  for (const m of hechos.movimientos) {
    switch (m.tipo) {
      case "GASTO_NEGOCIO":
        sumar(m.mes, "gastosNegocio", m.monto);
        break;
      case "APORTE":
        sumar(m.mes, "aportes", m.monto);
        break;
      case "RETIRO_CASA":
        sumar(m.mes, "retirosCasa", m.monto);
        break;
      case "INGRESO_CASA":
        sumar(m.mes, "ingresosCasa", m.monto);
        break;
      case "GASTO_FIJO":
        sumar(m.mes, "gastosFijos", m.monto);
        break;
      case "GASTO_VARIABLE":
        sumar(m.mes, "gastosVariables", m.monto);
        break;
      case "TRASLADO": {
        // Moving money between two savings accounts is neither a deposit nor a withdrawal.
        const entraAhorro = m.tipoDestino === "AHORRO" && m.tipoOrigen !== "AHORRO";
        const saleAhorro = m.tipoOrigen === "AHORRO" && m.tipoDestino !== "AHORRO";
        if (entraAhorro) sumar(m.mes, "depositosAhorro", m.monto);
        if (saleAhorro) sumar(m.mes, "retirosAhorro", m.monto);
        break;
      }
    }
  }

  return claves.map((mes) => {
    const fila = porMes.get(mes)!;
    const out = { mes } as HistorialMes;
    for (const [campo, centavos] of Object.entries(fila) as [keyof Acumulado, number][]) out[campo] = aPesos(centavos);
    return out;
  });
}
