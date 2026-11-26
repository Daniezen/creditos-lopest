/**
 * View model of the Resumen tab (`Resumen.dc.html`): the multi-month picture
 * that replaces Reportes' «Evolución y proyección».
 *
 * TWO HALVES.
 *   * `construirVistaResumen` is PURE: already-loaded rows in, plain view
 *     data out. Every figure is summed in integer cents (`dinero.ts`) and the
 *     module's engine (`domain/resumen.ts`) is fed those cents: the engine is
 *     unit-agnostic as long as values are integers, and cents keep the totals
 *     identical to Reportes' SQL SUM over Decimal(18, 2).
 *   * `obtenerVistaResumen` / `cargarVistaResumen` read the database with the
 *     same visibility helpers as the rest of the module.
 *
 * PARITY WITH REPORTES (`features/analytics/queries.ts`), which this tab must
 * be able to replace:
 *   * Cobrado per month = `getHistoricoRecaudacion`: events PAGADO or
 *     CANCELADO_POR_ABONO with a `fechaPago`, capital/interest split with the
 *     same CASE (`desgloseCobro`), total = capital + interest.
 *   * Viene per month = `getProyeccionCartera`: events PENDIENTE / ATRASADO /
 *     MORA by `fechaProgramada`, (programado − pagado) of capital and of
 *     interest. One deliberate difference: loans written off in this module
 *     (`cn_castigos`, not reverted) are left out, because a lost loan is not
 *     money that "viene". With no write-offs both totals are equal.
 *   * Scope = Reportes' `c."ownerUserId" = user` unless ADMIN, and never
 *     deleted loans: exactly `buildCreditoVisibilityWhere`.
 *   * Months are Bogota months (`mesClave`); Reportes truncates the stored
 *     UTC instant. Days are stored as Bogota midnight (05:00Z), which falls on
 *     the same calendar month in both, so the buckets agree.
 *
 * HISTORY SHORTER THAN THE WINDOW. Months before the first collection or
 * scheduled cuota are trimmed from the charts. Months before the module
 * started (`inicioModulo`, the first account opening) have real interest but
 * no recorded withdrawals, expenses or savings: those figures are `null`
 * ("no se anotaba"), never a misleading 0, and they never raise «el capital
 * bajó».
 */
import type { Prisma, PrismaClient } from "@prisma/client";

import { calcularCumplimientoCobros, calcularGananciaRetiros, proyectarCobros } from "@/features/casa-negocio/domain/resumen";
import { NOMBRES_MES } from "@/features/casa-negocio/domain/dates";
import { fechaClave, mesClave, rangoMes, sumarMeses } from "@/features/casa-negocio/mes";
import type { FechaDia, HistorialMes, Mes, TipoCuenta, TramoAtraso, TramoCartera } from "@/features/casa-negocio/types";
import { buildCreditoVisibilityWhere, buildEventoFinancieroVisibilityWhere } from "@/server/auth/scope";

import { construirHistorial, type HechoMovimiento } from "./agregados";
import { requireCapacidad } from "./capacidades";
import { aCentavos, aPesos, type Monetario } from "./dinero";
import { cargarAsientos, desgloseCobro, resumirSaldo, type EventoCobro } from "./saldos";
import { cargarCasaNegocioMes, type LectorCasaNegocio } from "./queries";

// ---------------------------------------------------------------------------
// Contract (plain data, safe to pass to Client Components)
// ---------------------------------------------------------------------------

/** Window of the «mes a mes» cards. The charts always show the last 12 months. */
export type RangoResumen = 12 | 24;
export const RANGOS_RESUMEN: readonly RangoResumen[] = [12, 24];

/** Months of history in both charts, and months projected ahead. */
export const MESES_GRAFICA = 12;
export const MESES_PROYECCION = 6;

export interface MesGananciaVista {
  mes: Mes;
  ganancia: number;
  /** Null before the module started: withdrawals were not recorded. */
  retiros: number | null;
  reinvertido: number | null;
  capitalBajo: boolean;
  anotado: boolean;
}

export interface GananciaVista {
  meses: MesGananciaVista[];
  mesesCapitalBajo: Mes[];
  /** Positive sum of the shortfalls. */
  capitalPerdido: number;
  /** «En mayo y julio se llevó a la casa más de lo que ganó el negocio: …», null when it never happened. */
  aviso: string | null;
  /** Text reading of the chart for assistive technology. */
  lectura: string;
}

export interface MesCobrosVista {
  mes: Mes;
  capital: number;
  interes: number;
  total: number;
  /** «Lo que tocaba cobrar»; null on projected months. */
  esperado: number | null;
  cumplimiento: number | null;
  proyectado: boolean;
}

export interface CobrosVista {
  /** History (oldest first), then the projected months. */
  meses: MesCobrosVista[];
  /** Index of the first projected month: HOY sits right before it. */
  indiceHoy: number;
  cobrado: number;
  esperado: number;
  /** Floored % of cobrado over esperado in the history window. */
  cumplimiento: number | null;
  viene: number;
  vieneIntereses: number;
  lectura: string;
}

export interface TramoVista {
  tramo: TramoAtraso;
  label: string;
  creditos: number;
  saldo: number;
}

export interface CarteraVista {
  tramos: TramoVista[];
  enLaCalle: number;
  creditos: number;
  lectura: string;
}

export interface TarjetaMes {
  mes: Mes;
  ganancia: number;
  retiros: number | null;
  reinvertido: number | null;
  /** Casa: entró − fijos − variables. */
  casaSobro: number | null;
  /** Balance of the savings accounts at month end. */
  ahorro: number | null;
  actual: boolean;
}

export interface VistaResumen {
  hoy: FechaDia;
  mesActual: Mes;
  rango: RangoResumen;
  ganancia: GananciaVista;
  cobros: CobrosVista;
  cartera: CarteraVista;
  /** Newest first, like the canvas (the current month leads, in ink). */
  tarjetas: TarjetaMes[];
}

// ---------------------------------------------------------------------------
// Pure input rows
// ---------------------------------------------------------------------------

/** A paid event (Reportes' historico rows). */
export interface FilaCobro extends EventoCobro {
  fechaPago: Date;
}

/** A scheduled cuota of a past month («lo que tocaba cobrar»). */
export interface FilaProgramada {
  fechaProgramada: Date;
  capitalProgramado: Monetario;
  interesProgramado: Monetario;
}

/** An unpaid cuota (Reportes' proyección rows). */
export interface FilaPendiente extends FilaProgramada {
  capitalPagado: Monetario;
  interesPagado: Monetario;
}

export interface DatosResumen {
  hoy: FechaDia;
  inicioModulo: FechaDia | null;
  rango: RangoResumen;
  cobros: readonly FilaCobro[];
  programadas: readonly FilaProgramada[];
  pendientes: readonly FilaPendiente[];
  movimientos: readonly HechoMovimiento[];
  castigos: readonly { mes: Mes; monto: Monetario }[];
  /** Savings balance at the end of each month, null where no savings account existed yet. */
  ahorroFinMes: Readonly<Record<Mes, number | null>>;
  tramos: readonly TramoCartera[];
}

// ---------------------------------------------------------------------------
// Aggregations (cents)
// ---------------------------------------------------------------------------

interface CapitalInteres {
  capital: number;
  interes: number;
}

function porMes<T>(filas: readonly T[], mesDe: (f: T) => Mes, montos: (f: T) => CapitalInteres): Map<Mes, CapitalInteres> {
  const out = new Map<Mes, CapitalInteres>();
  for (const fila of filas) {
    const mes = mesDe(fila);
    const acc = out.get(mes) ?? { capital: 0, interes: 0 };
    const m = montos(fila);
    acc.capital += m.capital;
    acc.interes += m.interes;
    out.set(mes, acc);
  }
  return out;
}

/** Collected capital / interest per Bogota month, in cents: Reportes' `getHistoricoRecaudacion`. */
export function cobradoPorMes(filas: readonly FilaCobro[]): Map<Mes, CapitalInteres> {
  return porMes(
    filas,
    (f) => mesClave(f.fechaPago),
    (f) => {
      const d = desgloseCobro(f);
      return { capital: aCentavos(d.capital), interes: aCentavos(d.interes) };
    },
  );
}

/** Scheduled capital / interest per month, in cents. */
export function programadoPorMes(filas: readonly FilaProgramada[]): Map<Mes, CapitalInteres> {
  return porMes(
    filas,
    (f) => mesClave(f.fechaProgramada),
    (f) => ({ capital: aCentavos(f.capitalProgramado), interes: aCentavos(f.interesProgramado) }),
  );
}

/** Still owed per cuota, in cents: Reportes' `getProyeccionCartera` (programado − pagado). */
export function pendienteDe(f: FilaPendiente): CapitalInteres {
  return {
    capital: aCentavos(f.capitalProgramado) - aCentavos(f.capitalPagado),
    interes: aCentavos(f.interesProgramado) - aCentavos(f.interesPagado),
  };
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

const TRAMO_LABEL: Record<TramoAtraso, string> = {
  AL_DIA: "Al día",
  "1_30": "1 a 30 días",
  "31_60": "31 a 60 días",
  "61_90": "61 a 90 días",
  MAS_90: "Más de 90 días",
};

function nombreMes(mes: Mes): string {
  return NOMBRES_MES[Number(mes.slice(5, 7)) - 1];
}

function nombreMesAnio(mes: Mes): string {
  return `${nombreMes(mes)} ${mes.slice(0, 4)}`;
}

/** «mayo», «mayo y julio», «mayo, junio y julio». */
function enumerar(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** «$ 2,0 M» for the notices, «$ 850.000» under a million. */
export function montoCorto(pesos: number): string {
  const abs = Math.abs(pesos);
  const sign = pesos < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    return `${sign}$ ${(abs / 1e6).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
  }
  return `${sign}$ ${Math.round(abs).toLocaleString("es-CO")}`;
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** Keys of the `n` months ending at `hasta`, oldest first. */
function ventana(hasta: Mes, n: number): Mes[] {
  return Array.from({ length: n }, (_, i) => sumarMeses(hasta, i - n + 1));
}

export function construirVistaResumen(datos: DatosResumen): VistaResumen {
  const mesActual = datos.hoy.slice(0, 7);
  const mesInicio = datos.inicioModulo ? datos.inicioModulo.slice(0, 7) : null;
  const anotado = (mes: Mes) => mesInicio !== null && mes >= mesInicio;
  const nHistoria = Math.max(MESES_GRAFICA, datos.rango);

  const cobrado = cobradoPorMes(datos.cobros);
  const programado = programadoPorMes(datos.programadas);

  // Withdrawals, expenses, house figures: the module's own history builder.
  const historial: HistorialMes[] = construirHistorial(
    mesActual,
    {
      cobros: [...cobrado].map(([mes, c]) => ({ mes, capital: aPesos(c.capital), interes: aPesos(c.interes), total: aPesos(c.capital + c.interes) })),
      desembolsos: [],
      movimientos: datos.movimientos,
      castigos: datos.castigos,
    },
    nHistoria,
  );
  const historialPorMes = new Map(historial.map((h) => [h.mes, h]));

  // Trim leading months with nothing at all (a portfolio younger than the window).
  const conActividad = (mes: Mes) => {
    const c = cobrado.get(mes);
    const p = programado.get(mes);
    return (c !== undefined && c.capital + c.interes !== 0) || (p !== undefined && p.capital + p.interes !== 0) || anotado(mes);
  };
  const recortar = (meses: Mes[]) => {
    const primero = meses.findIndex(conActividad);
    return primero < 0 ? [] : meses.slice(primero);
  };
  const mesesGrafica = recortar(ventana(mesActual, MESES_GRAFICA));

  // --- Ganancia y retiros ------------------------------------------------------
  const negocioDe = (mes: Mes) => {
    const h = historialPorMes.get(mes)!;
    return {
      interesesCobrados: cobrado.get(mes)?.interes ?? 0,
      gastos: aCentavos(h.gastosNegocio),
      perdidos: aCentavos(h.perdidas),
      retirosCasa: anotado(mes) ? aCentavos(h.retirosCasa) : 0,
    };
  };
  const gr = calcularGananciaRetiros(mesesGrafica.map((mes) => ({ mes, negocio: negocioDe(mes) })));
  const mesesGanancia: MesGananciaVista[] = gr.meses.map((m) => {
    const a = anotado(m.mes);
    return {
      mes: m.mes,
      ganancia: aPesos(m.ganancia),
      retiros: a ? aPesos(m.retiros) : null,
      reinvertido: a ? aPesos(m.reinvertido) : null,
      capitalBajo: a && m.capitalBajo,
      anotado: a,
    };
  });
  const bajos = mesesGanancia.filter((m) => m.capitalBajo);
  const capitalPerdido = aPesos(0 - bajos.reduce((s, m) => s + aCentavos(m.reinvertido), 0));
  const aviso =
    bajos.length === 0
      ? null
      : `En ${enumerar(bajos.map((m) => nombreMes(m.mes)))} se llevó a la casa más de lo que ganó el negocio: el capital bajó ${montoCorto(capitalPerdido)}.`;

  // --- Cobros -----------------------------------------------------------------
  const cumplimiento = calcularCumplimientoCobros(
    mesesGrafica.map((mes) => {
      const c = cobrado.get(mes) ?? { capital: 0, interes: 0 };
      const p = programado.get(mes) ?? { capital: 0, interes: 0 };
      return { mes, cobradoCapital: c.capital, cobradoInteres: c.interes, esperadoCapital: p.capital, esperadoInteres: p.interes };
    }),
  );
  const proyeccion = proyectarCobros(
    datos.pendientes.map((f) => ({ fechaProgramada: fechaClave(f.fechaProgramada), ...pendienteDe(f) })),
    mesActual,
    MESES_PROYECCION,
  );
  const mesesCobros: MesCobrosVista[] = [
    ...cumplimiento.meses.map((m) => ({
      mes: m.mes,
      capital: aPesos(m.cobradoCapital),
      interes: aPesos(m.cobradoInteres),
      total: aPesos(m.cobrado),
      esperado: aPesos(m.esperado),
      cumplimiento: m.cumplimiento,
      proyectado: false,
    })),
    ...proyeccion.meses.map((m) => ({
      mes: m.mes,
      capital: aPesos(m.capital),
      interes: aPesos(m.interes),
      total: aPesos(m.total),
      esperado: null,
      cumplimiento: null,
      proyectado: true,
    })),
  ];

  // --- Cartera ----------------------------------------------------------------
  const tramos: TramoVista[] = datos.tramos.map((t) => ({ tramo: t.tramo, label: TRAMO_LABEL[t.tramo], creditos: t.creditos, saldo: t.saldoCapital }));
  const enLaCalle = aPesos(tramos.reduce((s, t) => s + aCentavos(t.saldo), 0));
  const creditos = tramos.reduce((s, t) => s + t.creditos, 0);

  // --- Mes a mes ----------------------------------------------------------------
  const tarjetas: TarjetaMes[] = recortar(ventana(mesActual, datos.rango))
    .map((mes): TarjetaMes => {
      const h = historialPorMes.get(mes)!;
      const n = negocioDe(mes);
      const ganancia = n.interesesCobrados - n.gastos - n.perdidos;
      const a = anotado(mes);
      const casa = aCentavos(h.retirosCasa) + aCentavos(h.ingresosCasa) - aCentavos(h.gastosFijos) - aCentavos(h.gastosVariables);
      return {
        mes,
        ganancia: aPesos(ganancia),
        retiros: a ? aPesos(n.retirosCasa) : null,
        reinvertido: a ? aPesos(ganancia - n.retirosCasa) : null,
        casaSobro: a ? aPesos(casa) : null,
        ahorro: a ? (datos.ahorroFinMes[mes] ?? null) : null,
        actual: mes === mesActual,
      };
    })
    .reverse();

  const cobrosSinLectura: Omit<CobrosVista, "lectura"> = {
    meses: mesesCobros,
    indiceHoy: cumplimiento.meses.length,
    cobrado: aPesos(cumplimiento.cobrado),
    esperado: aPesos(cumplimiento.esperado),
    cumplimiento: cumplimiento.cumplimiento,
    viene: aPesos(proyeccion.total),
    vieneIntereses: aPesos(proyeccion.intereses),
  };

  return {
    hoy: datos.hoy,
    mesActual,
    rango: datos.rango,
    ganancia: {
      meses: mesesGanancia,
      mesesCapitalBajo: bajos.map((m) => m.mes),
      capitalPerdido,
      aviso,
      lectura: lecturaGanancia(mesesGanancia, aviso),
    },
    cobros: { ...cobrosSinLectura, lectura: lecturaCobros(cobrosSinLectura) },
    cartera: { tramos, enLaCalle, creditos, lectura: lecturaCartera(tramos, enLaCalle) },
    tarjetas,
  };
}

function lecturaGanancia(meses: readonly MesGananciaVista[], aviso: string | null): string {
  if (meses.length === 0) return "Todavía no hay meses con cobros.";
  const desde = nombreMesAnio(meses[0].mes);
  const hasta = nombreMesAnio(meses[meses.length - 1].mes);
  const mejor = meses.reduce((a, b) => (b.ganancia > a.ganancia ? b : a));
  const partes = [
    `Ganancia neta y lo que se llevó la casa, de ${desde} a ${hasta}.`,
    `La mayor ganancia fue en ${nombreMesAnio(mejor.mes)}: ${montoCorto(mejor.ganancia)}.`,
  ];
  const sinAnotar = meses.filter((m) => !m.anotado).length;
  if (sinAnotar > 0) partes.push(`En ${sinAnotar === 1 ? "el primer mes" : `los primeros ${sinAnotar} meses`} los retiros no se anotaban.`);
  partes.push(aviso ?? "Ningún mes se llevó a la casa más de lo que ganó el negocio.");
  return partes.join(" ");
}

function lecturaCobros(c: Omit<CobrosVista, "lectura">): string {
  const historia = c.meses.filter((m) => !m.proyectado);
  if (historia.length === 0) return "Todavía no hay cobros.";
  const desde = nombreMesAnio(historia[0].mes);
  const hasta = nombreMesAnio(historia[historia.length - 1].mes);
  const pct = c.cumplimiento === null ? "" : `, el ${c.cumplimiento} % de lo que tocaba cobrar`;
  return [
    `Cobros mensuales de ${desde} a ${hasta}: ${montoCorto(c.cobrado)} en total${pct}.`,
    `En los próximos ${MESES_PROYECCION} meses vienen ${montoCorto(c.viene)} si todos pagan a tiempo, de los que ${montoCorto(c.vieneIntereses)} son intereses.`,
  ].join(" ");
}

function lecturaCartera(tramos: readonly TramoVista[], enLaCalle: number): string {
  const con = tramos.filter((t) => t.creditos > 0);
  if (con.length === 0) return "No hay créditos activos.";
  return `Cartera de ${montoCorto(enLaCalle)} por días de atraso: ${con
    .map((t) => `${t.label.toLowerCase()}, ${montoCorto(t.saldo)} en ${t.creditos} ${t.creditos === 1 ? "crédito" : "créditos"}`)
    .join("; ")}.`;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

type Db = PrismaClient | Prisma.TransactionClient;

const ESTADOS_COBRADOS = ["PAGADO", "CANCELADO_POR_ABONO"] as const;
const ESTADOS_PENDIENTES = ["PENDIENTE", "ATRASADO", "MORA"] as const;

/** `?rango=` of the page: 24 or the default 12. */
export function parseRango(valor: string | string[] | undefined): RangoResumen {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v === "24" ? 24 : 12;
}

/** Entry point for the page: authenticates, demands `casa_negocio.ver`, loads. */
export async function obtenerVistaResumen(rango: RangoResumen): Promise<VistaResumen> {
  const actor = await requireCapacidad("VER");
  const { prisma } = await import("@/lib/prisma");
  return cargarVistaResumen(prisma, actor, rango);
}

/**
 * Reads everything the tab needs for an authorized viewer. The portfolio
 * buckets come from the module's month read (`cargarCasaNegocioMes`), so the
 * Tablero's «en la calle» and this tab never disagree.
 */
export async function cargarVistaResumen(
  db: Db,
  lector: LectorCasaNegocio,
  rango: RangoResumen,
  ahora: Date = new Date(),
): Promise<VistaResumen> {
  const hoy = fechaClave(ahora);
  const mesActual = hoy.slice(0, 7);
  const nHistoria = Math.max(MESES_GRAFICA, rango);
  const inicioVentana = rangoMes(sumarMeses(mesActual, 1 - nHistoria)).inicio;
  const finActual = rangoMes(mesActual).fin;
  const finProyeccion = rangoMes(sumarMeses(mesActual, MESES_PROYECCION)).fin;

  const creditoVisible = buildCreditoVisibilityWhere(lector);
  const eventoVisible: Prisma.EventoFinancieroWhereInput = {
    AND: [buildEventoFinancieroVisibilityWhere(lector), { credito: creditoVisible }],
  };

  const [mesModulo, cobros, programadas, pendientes, movimientos, cuentas, castigos, asientos] = await Promise.all([
    cargarCasaNegocioMes(db, lector, mesActual, ahora),
    db.eventoFinanciero.findMany({
      where: { ...eventoVisible, estado: { in: [...ESTADOS_COBRADOS] }, fechaPago: { gte: inicioVentana, lt: finActual } },
      select: {
        tipo: true,
        fechaPago: true,
        montoPagado: true,
        capitalPagado: true,
        interesPagado: true,
        capitalProgramado: true,
        interesProgramado: true,
      },
    }),
    db.eventoFinanciero.findMany({
      where: {
        ...eventoVisible,
        tipo: "CUOTA_PROGRAMADA",
        estado: { not: "CANCELADO_POR_ABONO" },
        fechaProgramada: { gte: inicioVentana, lt: finActual },
      },
      select: { fechaProgramada: true, capitalProgramado: true, interesProgramado: true },
    }),
    db.eventoFinanciero.findMany({
      where: {
        AND: [eventoVisible, { credito: { cnCastigos: { none: { revertidoEn: null } } } }],
        estado: { in: [...ESTADOS_PENDIENTES] },
        fechaProgramada: { gte: finActual, lt: finProyeccion },
      },
      select: { fechaProgramada: true, capitalProgramado: true, interesProgramado: true, capitalPagado: true, interesPagado: true },
    }),
    db.cnMovimiento.findMany({
      where: { eliminadoEn: null, fecha: { gte: inicioVentana, lt: finActual } },
      select: { fecha: true, tipo: true, monto: true, cuentaOrigenId: true, cuentaDestinoId: true },
    }),
    db.cnCuenta.findMany({ select: { id: true, tipo: true, saldoInicial: true, fechaSaldoInicial: true } }),
    db.cnCastigoCredito.findMany({
      where: { revertidoEn: null, credito: creditoVisible, fecha: { gte: inicioVentana, lt: finActual } },
      select: { fecha: true, monto: true },
    }),
    cargarAsientos(db),
  ]);

  const tipoCuenta = new Map<string, TipoCuenta>(cuentas.map((c) => [c.id, c.tipo]));
  const ahorros = cuentas.filter((c) => c.tipo === "AHORRO");
  const ahorroFinMes: Record<Mes, number | null> = {};
  for (const mes of ventana(mesActual, nHistoria)) {
    const { inicio, fin } = rangoMes(mes);
    const abiertas = ahorros.filter((c) => c.fechaSaldoInicial.getTime() < fin.getTime());
    ahorroFinMes[mes] =
      abiertas.length === 0
        ? null
        : aPesos(abiertas.reduce((s, c) => s + aCentavos(resumirSaldo(c, asientos, inicio, fin).saldoFin), 0));
  }

  return construirVistaResumen({
    hoy,
    inicioModulo: mesModulo.inicioModulo,
    rango,
    // `fechaPago` is never null here: the where clause demands a range.
    cobros: cobros.map((e) => ({ ...e, fechaPago: e.fechaPago! })),
    programadas,
    pendientes,
    movimientos: movimientos.map((m) => ({
      mes: mesClave(m.fecha),
      tipo: m.tipo,
      monto: m.monto,
      tipoOrigen: m.cuentaOrigenId ? (tipoCuenta.get(m.cuentaOrigenId) ?? null) : null,
      tipoDestino: m.cuentaDestinoId ? (tipoCuenta.get(m.cuentaDestinoId) ?? null) : null,
    })),
    castigos: castigos.map((c) => ({ mes: mesClave(c.fecha), monto: c.monto })),
    ahorroFinMes,
    tramos: mesModulo.cartera.tramos,
  });
}
