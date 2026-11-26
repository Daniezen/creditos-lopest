/**
 * A simulated "world" for the end-to-end calculation tests of Casa y Negocio:
 * the raw facts the database would hold (accounts, manual movements, loans,
 * financial events, account assignments, write-offs, arqueos, categories,
 * settings) and two pure readers that turn them into exactly what the tabs
 * consume:
 *
 *   - `leerMes(mundo, mes, ahora)`  → `CasaNegocioMes`, mirroring
 *     `cargarCasaNegocioMes` (queries.ts) step by step;
 *   - `leerResumen(mundo, ahora)`   → `DatosResumen`, mirroring
 *     `cargarVistaResumen` (vista-resumen.ts).
 *
 * WHY A WORLD AND NOT A HAND-WRITTEN `CasaNegocioMes`. A hand-written month
 * already contains the answers (saldoFinMes, gastadoMes, historial...), so a
 * test over it can only check the tab against the author's arithmetic. Here
 * every derived field is produced by the SAME pure helpers the real read uses
 * (`resumirSaldo`, `asientosDeMovimiento`, `desgloseCobro`,
 * `construirHistorial`, `categoriaDelMes`, `calcularSaldoCapitalActual`,
 * `rangoMes`/`fechaClave`), while the tests state the expected totals by hand
 * from the story below. The DB-level test (`db.integration.test.ts`) replays
 * the same story through the real services and query, which keeps this
 * mirror honest.
 *
 * TIME. `corte(mundo, ahora)` keeps only what existed at `ahora`: movements
 * dated up to today, loans already lent, payments already made (a cuota paid
 * later reads as still pending), write-offs and arqueos already recorded. So
 * one world answers "what did the family see on the 21st of December" and
 * "what do they see on the 20th of January" without two fixtures.
 *
 * Days are Bogota calendar days stored as local midnight (05:00Z), exactly as
 * the app stores them; payment instants may be any instant (the 31-Dec
 * 23:59 cobro is `2027-01-01T04:59Z`).
 */
import { calcularSaldoCapitalActual } from "@/features/creditos/current-capital-balance";
import { CAPACIDADES, CODIGOS_AVISO } from "@/features/casa-negocio/schemas";
import { bogotaMidnight, diasEntre, fechaClave, mesClave, rangoMes, sumarMeses } from "@/features/casa-negocio/mes";
import type {
  CasaNegocioMes,
  CategoriaMes,
  ClaseGasto,
  CodigoAviso,
  CreditoCartera,
  GrupoCuenta,
  Periodicidad,
  TipoCuenta,
  TipoMovimiento,
  TramoCartera,
} from "@/features/casa-negocio/types";

import { TRAMOS, categoriaDelMes, construirHistorial, tramoDe } from "../../agregados";
import { aCentavos, aPesos, sumar } from "../../dinero";
import { asientosDeMovimiento, desgloseCobro, resumirSaldo, type Asiento } from "../../saldos";
import { mesDeClaveCierre, type CierreAhorroRegistro } from "../../vista-ahorro";
import { alCierreCasa } from "../../vista-mes";
import type { DatosResumen } from "../../vista-resumen";

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export interface CuentaMundo {
  id: string;
  nombre: string;
  grupo: GrupoCuenta;
  tipo: TipoCuenta;
  saldoInicial: number;
  fechaSaldoInicial: string;
  archivada?: boolean;
}

export interface MovimientoMundo {
  id: string;
  tipo: TipoMovimiento;
  fecha: string;
  monto: number;
  origen?: string;
  destino?: string;
  categoria?: string;
  nota?: string;
  /** Voided (soft-deleted): never counted anywhere. */
  anulado?: boolean;
  /** `idempotencyKey`, used by the Ahorro cierre (`ahorro-cierre-AAAA-MM-n`). */
  clave?: string;
}

export interface EventoMundo {
  id: string;
  creditoId: string;
  tipo: "CUOTA_PROGRAMADA" | "ABONO_CAPITAL";
  numeroCuota: number | null;
  fechaProgramada: string;
  capitalProgramado: number;
  interesProgramado: number;
  /** Paid: the instant and the split. Absent = still owed. */
  pago?: { en: Date; capital: number; interes: number; saldoCapitalPost: number };
  /** Estado while unpaid (default PENDIENTE). */
  estadoPendiente?: "PENDIENTE" | "ATRASADO" | "MORA";
  /** «¿Dónde entró?» assignment. */
  cuentaId?: string;
}

export interface CreditoMundo {
  id: string;
  codigo: string;
  cliente: string;
  monto: number;
  fechaPrestamo: string;
  /** «¿De dónde salió?» assignment of the disbursement. */
  cuentaId?: string;
}

export interface CastigoMundo {
  id: string;
  creditoId: string;
  monto: number;
  fecha: string;
  motivo: string;
  revertido?: boolean;
}

export interface ArqueoMundo {
  id: string;
  /** ISO instant. */
  fecha: string;
  detalles: { cuentaId: string; saldoSistema: number; contado: number }[];
}

export interface CategoriaMundo {
  id: string;
  nombre: string;
  clase: ClaseGasto;
  monto: number | null;
  periodicidad: Periodicidad;
  mesAnual: number | null;
  diaPago: number | null;
  activa?: boolean;
}

export interface Mundo {
  cuentas: CuentaMundo[];
  movimientos: MovimientoMundo[];
  creditos: CreditoMundo[];
  eventos: EventoMundo[];
  castigos: CastigoMundo[];
  arqueos: ArqueoMundo[];
  categorias: CategoriaMundo[];
  cuentaAhorroId: string | null;
  metaAhorro: number | null;
  reglas: Partial<Record<CodigoAviso, { activa?: boolean; umbral?: number | null }>>;
}

const V = "2026-12-01T05:00:00.000Z";
/** A Bogota day as the app stores it (local midnight). */
export const dia = (fecha: string): Date => {
  const [a, m, d] = fecha.split("-").map(Number);
  return bogotaMidnight(a, m, d);
};
/** A Bogota wall-clock instant (UTC-5 all year). */
export const local = (fecha: string, hora = "12:00"): Date => new Date(`${fecha}T${hora}:00.000-05:00`);

// ---------------------------------------------------------------------------
// The story: December 2026 (module start) and January 2027
// ---------------------------------------------------------------------------

/**
 * Accounts open on 2026-12-01. Loans A, C and D predate the module; B and E
 * are new in December. See the test files for the expected figures, written
 * out by hand from this list.
 */
export function mundoBase(): Mundo {
  return {
    cuentas: [
      { id: "efectivo", nombre: "Efectivo", grupo: "NEGOCIO", tipo: "EFECTIVO", saldoInicial: 4_000_000, fechaSaldoInicial: "2026-12-01" },
      { id: "banco", nombre: "Bancolombia", grupo: "NEGOCIO", tipo: "BANCO", saldoInicial: 10_000_000, fechaSaldoInicial: "2026-12-01" },
      { id: "nequi", nombre: "Nequi", grupo: "NEGOCIO", tipo: "BILLETERA", saldoInicial: 500_000, fechaSaldoInicial: "2026-12-01" },
      { id: "casa", nombre: "Cuenta casa", grupo: "CASA", tipo: "BANCO", saldoInicial: 800_000, fechaSaldoInicial: "2026-12-01" },
      { id: "nu", nombre: "Nu", grupo: "CASA", tipo: "AHORRO", saldoInicial: 5_000_000, fechaSaldoInicial: "2026-12-01" },
    ],
    categorias: [
      { id: "arriendo", nombre: "Arriendo", clase: "FIJO", monto: 1_500_000, periodicidad: "MENSUAL", mesAnual: null, diaPago: 5 },
      { id: "servicios", nombre: "Servicios", clase: "FIJO", monto: 300_000, periodicidad: "MENSUAL", mesAnual: null, diaPago: 20 },
      { id: "soat", nombre: "SOAT", clase: "FIJO", monto: 900_000, periodicidad: "ANUAL", mesAnual: 1, diaPago: 25 },
      { id: "predial", nombre: "Predial", clase: "FIJO", monto: 1_200_000, periodicidad: "ANUAL", mesAnual: 6, diaPago: 30 },
      { id: "mercado", nombre: "Mercado", clase: "VARIABLE", monto: 2_000_000, periodicidad: "MENSUAL", mesAnual: null, diaPago: null },
      { id: "gasolina", nombre: "Gasolina", clase: "VARIABLE", monto: 300_000, periodicidad: "MENSUAL", mesAnual: null, diaPago: null },
    ],
    movimientos: [
      // December
      { id: "d-retiro-1", tipo: "RETIRO_CASA", fecha: "2026-12-02", monto: 1_200_000, origen: "banco", destino: "casa" },
      { id: "d-gasto-neg", tipo: "GASTO_NEGOCIO", fecha: "2026-12-04", monto: 80_000, origen: "efectivo", nota: "Papelería" },
      { id: "d-arriendo", tipo: "GASTO_FIJO", fecha: "2026-12-05", monto: 1_500_000, origen: "casa", categoria: "arriendo" },
      { id: "d-aporte", tipo: "APORTE", fecha: "2026-12-06", monto: 1_000_000, destino: "nequi", nota: "Ahorros propios" },
      { id: "d-mercado", tipo: "GASTO_VARIABLE", fecha: "2026-12-08", monto: 900_000, origen: "casa", categoria: "mercado" },
      { id: "d-gasolina", tipo: "GASTO_VARIABLE", fecha: "2026-12-09", monto: 280_000, origen: "casa", categoria: "gasolina" },
      { id: "d-traslado", tipo: "TRASLADO", fecha: "2026-12-11", monto: 500_000, origen: "banco", destino: "efectivo" },
      { id: "d-ingreso", tipo: "INGRESO_CASA", fecha: "2026-12-12", monto: 400_000, destino: "casa", nota: "Arriendo recibido" },
      { id: "d-anulado", tipo: "GASTO_NEGOCIO", fecha: "2026-12-14", monto: 50_000, origen: "nequi", nota: "Duplicado", anulado: true },
      { id: "d-retiro-2", tipo: "RETIRO_CASA", fecha: "2026-12-16", monto: 1_800_000, origen: "banco", destino: "casa" },
      { id: "d-servicios", tipo: "GASTO_FIJO", fecha: "2026-12-22", monto: 300_000, origen: "casa", categoria: "servicios" },
      // January
      { id: "e-cierre-dic", tipo: "TRASLADO", fecha: "2027-01-02", monto: 420_000, origen: "casa", destino: "nu", nota: "Cierre de diciembre", clave: "ahorro-cierre-2026-12-0" },
      { id: "e-retiro", tipo: "RETIRO_CASA", fecha: "2027-01-02", monto: 100_000, origen: "banco", destino: "casa" },
      { id: "e-ingreso", tipo: "INGRESO_CASA", fecha: "2027-01-04", monto: 2_000_000, destino: "casa", nota: "Regalo" },
      { id: "e-arriendo", tipo: "GASTO_FIJO", fecha: "2027-01-05", monto: 1_500_000, origen: "casa", categoria: "arriendo" },
      { id: "e-gasto-neg", tipo: "GASTO_NEGOCIO", fecha: "2027-01-10", monto: 30_000, origen: "banco", nota: "Transporte" },
    ],
    creditos: [
      { id: "cr-a", codigo: "LP-A", cliente: "Ana", monto: 6_000_000, fechaPrestamo: "2026-10-01" },
      { id: "cr-b", codigo: "LP-B", cliente: "Beto", monto: 3_000_000, fechaPrestamo: "2026-12-03", cuentaId: "efectivo" },
      { id: "cr-c", codigo: "LP-C", cliente: "Carla", monto: 4_000_000, fechaPrestamo: "2026-08-01" },
      { id: "cr-d", codigo: "LP-D", cliente: "Dario", monto: 2_000_000, fechaPrestamo: "2026-06-01" },
      { id: "cr-e", codigo: "LP-E", cliente: "Elsa", monto: 1_000_000, fechaPrestamo: "2026-12-18" },
    ],
    eventos: [
      // A: one cuota before the module (stays «sin cuenta» for good), one in December.
      { id: "a1", creditoId: "cr-a", tipo: "CUOTA_PROGRAMADA", numeroCuota: 1, fechaProgramada: "2026-11-01", capitalProgramado: 1_000_000, interesProgramado: 300_000, pago: { en: dia("2026-11-01"), capital: 1_000_000, interes: 300_000, saldoCapitalPost: 5_000_000 } },
      { id: "a2", creditoId: "cr-a", tipo: "CUOTA_PROGRAMADA", numeroCuota: 2, fechaProgramada: "2026-12-15", capitalProgramado: 1_000_000, interesProgramado: 300_000, pago: { en: dia("2026-12-15"), capital: 1_000_000, interes: 300_000, saldoCapitalPost: 4_000_000 }, cuentaId: "banco" },
      { id: "a3", creditoId: "cr-a", tipo: "CUOTA_PROGRAMADA", numeroCuota: 3, fechaProgramada: "2027-01-15", capitalProgramado: 1_000_000, interesProgramado: 300_000 },
      { id: "a4", creditoId: "cr-a", tipo: "CUOTA_PROGRAMADA", numeroCuota: 4, fechaProgramada: "2027-02-15", capitalProgramado: 1_000_000, interesProgramado: 300_000 },
      // B: lent in December, first cuota paid in January into Nequi.
      { id: "b1", creditoId: "cr-b", tipo: "CUOTA_PROGRAMADA", numeroCuota: 1, fechaProgramada: "2027-01-03", capitalProgramado: 500_000, interesProgramado: 150_000, pago: { en: dia("2027-01-03"), capital: 500_000, interes: 150_000, saldoCapitalPost: 2_500_000 }, cuentaId: "nequi" },
      { id: "b2", creditoId: "cr-b", tipo: "CUOTA_PROGRAMADA", numeroCuota: 2, fechaProgramada: "2027-02-03", capitalProgramado: 500_000, interesProgramado: 125_000 },
      // C: an abono into the bank, and a cuota paid at 23:59 on New Year's Eve, never assigned.
      { id: "c-abono", creditoId: "cr-c", tipo: "ABONO_CAPITAL", numeroCuota: null, fechaProgramada: "2026-12-10", capitalProgramado: 0, interesProgramado: 0, pago: { en: dia("2026-12-10"), capital: 1_000_000, interes: 0, saldoCapitalPost: 3_000_000 }, cuentaId: "banco" },
      { id: "c1", creditoId: "cr-c", tipo: "CUOTA_PROGRAMADA", numeroCuota: 1, fechaProgramada: "2026-12-31", capitalProgramado: 400_000, interesProgramado: 200_000, pago: { en: local("2026-12-31", "23:59"), capital: 400_000, interes: 200_000, saldoCapitalPost: 2_600_000 } },
      { id: "c2", creditoId: "cr-c", tipo: "CUOTA_PROGRAMADA", numeroCuota: 2, fechaProgramada: "2027-01-31", capitalProgramado: 400_000, interesProgramado: 180_000 },
      // D: never paid, in MORA since July; written off on Dec 20.
      { id: "d1", creditoId: "cr-d", tipo: "CUOTA_PROGRAMADA", numeroCuota: 1, fechaProgramada: "2026-07-01", capitalProgramado: 2_000_000, interesProgramado: 100_000, estadoPendiente: "MORA" },
      // E: lent on Dec 18 from an account nobody picked yet.
      { id: "e1", creditoId: "cr-e", tipo: "CUOTA_PROGRAMADA", numeroCuota: 1, fechaProgramada: "2027-01-18", capitalProgramado: 1_000_000, interesProgramado: 100_000 },
    ],
    castigos: [{ id: "cast-d", creditoId: "cr-d", monto: 1_500_000, fecha: "2026-12-20", motivo: "Se fue de la ciudad" }],
    arqueos: [
      // Efectivo on the 21st: Lopest said 1.420.000, there were 1.400.000.
      { id: "arq-1", fecha: local("2026-12-21", "18:00").toISOString(), detalles: [{ cuentaId: "efectivo", saldoSistema: 1_420_000, contado: 1_400_000 }] },
    ],
    cuentaAhorroId: "nu",
    metaAhorro: 10_000_000,
    reglas: {},
  };
}

/** Deep copy, so a test can change the story without touching the others. */
export function clonar(m: Mundo): Mundo {
  return structuredClone(m);
}

// ---------------------------------------------------------------------------
// Time cut
// ---------------------------------------------------------------------------

/** The world as it was at `ahora`: only what had already happened. */
export function corte(m: Mundo, ahora: Date): Mundo {
  const hoy = fechaClave(ahora);
  const t = ahora.getTime();
  return {
    ...m,
    movimientos: m.movimientos.filter((x) => x.fecha <= hoy),
    creditos: m.creditos.filter((c) => c.fechaPrestamo <= hoy),
    eventos: m.eventos
      .filter((e) => m.creditos.some((c) => c.id === e.creditoId && c.fechaPrestamo <= hoy))
      .map((e) => (e.pago && e.pago.en.getTime() > t ? { ...e, pago: undefined, cuentaId: undefined } : e)),
    castigos: m.castigos.filter((c) => c.fecha <= hoy),
    arqueos: m.arqueos.filter((a) => new Date(a.fecha).getTime() <= t),
  };
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

const vivos = (m: Mundo) => m.movimientos.filter((x) => !x.anulado);
const castigoActivo = (m: Mundo, creditoId: string) => m.castigos.some((c) => c.creditoId === creditoId && !c.revertido);
const estadoDe = (e: EventoMundo) => (e.pago ? "PAGADO" : (e.estadoPendiente ?? "PENDIENTE"));

/** The event as `desgloseCobro` / `calcularSaldoCapitalActual` read it. */
function filaEvento(e: EventoMundo) {
  return {
    tipo: e.tipo,
    estado: estadoDe(e),
    montoPagado: e.pago ? e.pago.capital + e.pago.interes : 0,
    capitalPagado: e.pago?.capital ?? 0,
    interesPagado: e.pago?.interes ?? 0,
    capitalProgramado: e.capitalProgramado,
    interesProgramado: e.interesProgramado,
    saldoCapitalPost: e.pago?.saldoCapitalPost ?? null,
  };
}

/** Every asiento of the module, as `cargarAsientos` builds them. */
export function asientosDe(m: Mundo): Asiento[] {
  const asientos: Asiento[] = vivos(m).flatMap((x) =>
    asientosDeMovimiento({ fecha: dia(x.fecha), monto: x.monto, cuentaOrigenId: x.origen ?? null, cuentaDestinoId: x.destino ?? null }),
  );
  for (const e of m.eventos) {
    if (!e.cuentaId || !e.pago) continue;
    asientos.push({ cuentaId: e.cuentaId, fecha: e.pago.en, centavos: aCentavos(desgloseCobro(filaEvento(e)).total) });
  }
  for (const c of m.creditos) {
    if (c.cuentaId) asientos.push({ cuentaId: c.cuentaId, fecha: dia(c.fechaPrestamo), centavos: -aCentavos(c.monto) });
  }
  return asientos;
}

function reglasDe(m: Mundo): CasaNegocioMes["configuracion"]["reglas"] {
  return CODIGOS_AVISO.map((codigo) => ({
    codigo,
    activa: m.reglas[codigo]?.activa ?? true,
    umbral: m.reglas[codigo]?.umbral ?? null,
    version: V,
  }));
}

/** `cargarCasaNegocioMes` over the world as it was at `ahora`. */
export function leerMes(mundo: Mundo, mes: string, ahora: Date): CasaNegocioMes {
  const m = corte(mundo, ahora);
  const hoy = fechaClave(ahora);
  const { inicio, fin } = rangoMes(mes);
  const inicioHistorial = rangoMes(sumarMeses(mes, -11)).inicio;
  const finProyeccion = rangoMes(sumarMeses(mes, 5)).fin;
  const enMes = (f: Date) => f >= inicio && f < fin;
  const enHistorial = (f: Date) => f >= inicioHistorial && f < fin;

  const aperturasNegocio = m.cuentas.filter((c) => c.grupo === "NEGOCIO").map((c) => dia(c.fechaSaldoInicial).getTime());
  const inicioNegocio = aperturasNegocio.length ? Math.min(...aperturasNegocio) : null;
  const esAsignable = (f: Date) => inicioNegocio !== null && f.getTime() >= inicioNegocio;
  const aperturas = m.cuentas.map((c) => c.fechaSaldoInicial).sort();
  const credito = new Map(m.creditos.map((c) => [c.id, c]));
  const tipoCuenta = new Map(m.cuentas.map((c) => [c.id, c.tipo]));

  const asientos = asientosDe(m);
  const cuentas = m.cuentas.map((c) => {
    const r = resumirSaldo({ id: c.id, saldoInicial: c.saldoInicial, fechaSaldoInicial: dia(c.fechaSaldoInicial) }, asientos, inicio, fin);
    const ultimo = m.arqueos
      .filter((a) => a.detalles.some((d) => d.cuentaId === c.id))
      .map((a) => a.fecha)
      .sort()
      .at(-1);
    return {
      id: c.id,
      nombre: c.nombre,
      grupo: c.grupo,
      tipo: c.tipo,
      orden: 0,
      archivada: c.archivada ?? false,
      saldoInicial: r.saldoInicial,
      fechaSaldoInicial: c.fechaSaldoInicial,
      saldoInicioMes: r.saldoInicio,
      entradasMes: r.entradas,
      salidasMes: r.salidas,
      saldoFinMes: r.saldoFin,
      saldoActual: r.saldoActual,
      ultimoArqueo: ultimo ?? null,
      version: V,
    };
  });

  const movsHistorial = vivos(m).filter((x) => enHistorial(dia(x.fecha)));
  const movsMes = movsHistorial.filter((x) => enMes(dia(x.fecha))).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const aMovimiento = (x: MovimientoMundo) => ({
    id: x.id,
    tipo: x.tipo,
    fecha: x.fecha,
    monto: x.monto,
    cuentaOrigenId: x.origen ?? null,
    cuentaDestinoId: x.destino ?? null,
    categoriaId: x.categoria ?? null,
    nota: x.nota ?? null,
    accionPor: null,
    creadoEn: `${x.fecha}T15:00:00.000Z`,
    version: V,
  });
  const movimientos = movsMes.map(aMovimiento);

  const ref = (creditoId: string) => {
    const c = credito.get(creditoId)!;
    return { creditoId: c.id, creditoCodigo: c.codigo, clienteNombre: c.cliente, dueno: null, esPropio: true };
  };
  const cobrosTodos = m.eventos
    .filter((e) => e.pago)
    .sort((a, b) => a.pago!.en.getTime() - b.pago!.en.getTime())
    .map((e) => {
      const { capital, interes, total } = desgloseCobro(filaEvento(e));
      return {
        fecha: e.pago!.en,
        cobro: {
          eventoFinancieroId: e.id,
          ...ref(e.creditoId),
          tipo: e.tipo === "ABONO_CAPITAL" ? ("ABONO" as const) : ("CUOTA" as const),
          numeroCuota: e.numeroCuota,
          fechaPago: fechaClave(e.pago!.en),
          capital,
          interes,
          total,
          cuentaId: e.cuentaId ?? null,
          asignacionVersion: e.cuentaId ? V : null,
          asignable: esAsignable(e.pago!.en),
        },
      };
    });
  const desembolsosTodos = [...m.creditos]
    .sort((a, b) => a.fechaPrestamo.localeCompare(b.fechaPrestamo))
    .map((c) => ({
      fecha: dia(c.fechaPrestamo),
      desembolso: {
        ...ref(c.id),
        fecha: c.fechaPrestamo,
        monto: c.monto,
        cuentaId: c.cuentaId ?? null,
        asignacionVersion: c.cuentaId ? V : null,
        asignable: esAsignable(dia(c.fechaPrestamo)),
      },
    }));

  const pendientes = m.eventos
    .filter((e) => e.tipo === "CUOTA_PROGRAMADA" && !e.pago && !castigoActivo(m, e.creditoId))
    .filter((e) => dia(e.fechaProgramada) < finProyeccion)
    .sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada))
    .map((e) => {
      const vencida = e.fechaProgramada < hoy;
      return {
        fecha: dia(e.fechaProgramada),
        cuota: {
          eventoFinancieroId: e.id,
          ...ref(e.creditoId),
          numeroCuota: e.numeroCuota,
          fechaProgramada: e.fechaProgramada,
          estado: e.estadoPendiente ?? "PENDIENTE",
          pendiente: e.capitalProgramado + e.interesProgramado,
          capital: e.capitalProgramado,
          interes: e.interesProgramado,
          diasAtraso: vencida ? diasEntre(e.fechaProgramada, hoy) : 0,
          vencida,
        },
      };
    });

  const programadosMes = m.eventos.filter((e) => e.tipo === "CUOTA_PROGRAMADA" && enMes(dia(e.fechaProgramada)));

  const creditosCartera: CreditoCartera[] = m.creditos.map((c) => {
    const eventos = m.eventos.filter((e) => e.creditoId === c.id);
    let diasAtraso = 0;
    let vencido = 0;
    let ultimoPago: Date | null = null;
    for (const e of eventos) {
      if (e.pago && (!ultimoPago || e.pago.en > ultimoPago)) ultimoPago = e.pago.en;
      if (e.tipo !== "CUOTA_PROGRAMADA" || e.pago || e.fechaProgramada >= hoy) continue;
      diasAtraso = Math.max(diasAtraso, diasEntre(e.fechaProgramada, hoy));
      vencido += aCentavos(e.capitalProgramado + e.interesProgramado);
    }
    return {
      ...ref(c.id),
      saldoCapital: calcularSaldoCapitalActual(c.monto, eventos.map(filaEvento)),
      diasAtraso,
      tramo: tramoDe(diasAtraso),
      montoVencido: aPesos(vencido),
      ultimoPago: ultimoPago ? fechaClave(ultimoPago) : null,
      diasSinPago: Math.max(0, diasEntre(ultimoPago ? fechaClave(ultimoPago) : c.fechaPrestamo, hoy)),
      castigado: castigoActivo(m, c.id),
    };
  });
  const vivosCartera = creditosCartera.filter((c) => !c.castigado);
  const tramos: TramoCartera[] = TRAMOS.map((tramo) => {
    const del = vivosCartera.filter((c) => c.tramo === tramo);
    return { tramo, creditos: del.length, saldoCapital: sumar(del.map((c) => c.saldoCapital)), montoVencido: sumar(del.map((c) => c.montoVencido)) };
  });

  const categoriasDe = (mesCat: string, movs: readonly MovimientoMundo[]): CategoriaMes[] => m.categorias.map((c, i) => ({
    id: c.id,
    nombre: c.nombre,
    clase: c.clase,
    monto: c.monto,
    periodicidad: c.periodicidad,
    mesAnual: c.mesAnual,
    diaPago: c.diaPago,
    activa: c.activa ?? true,
    orden: i,
    ...categoriaDelMes(c, mesCat, hoy, movs.filter((x) => x.categoria === c.id).map((x) => x.monto)),
    version: V,
  }));
  const categorias = categoriasDe(mes, movsMes);

  // Previous month's cierre, as queries.ts computes it for today's month.
  let cierreAnterior: CasaNegocioMes["cierreAnterior"] = null;
  if (mes === hoy.slice(0, 7)) {
    const anterior = sumarMeses(mes, -1);
    const movsAnterior = movsHistorial.filter((x) => x.fecha.startsWith(anterior));
    cierreAnterior = {
      mes: anterior,
      sobrante: alCierreCasa(anterior, hoy, { movimientos: movsAnterior.map(aMovimiento), categorias: categoriasDe(anterior, movsAnterior) }),
      pasadoAlAhorro: sumar(movsHistorial.filter((x) => mesDeClaveCierre(x.clave ?? null) === anterior).map((x) => x.monto)),
    };
  }

  const castigosVivos = m.castigos.filter((c) => !c.revertido);
  const historial = construirHistorial(mes, {
    cobros: cobrosTodos.filter((c) => enHistorial(c.fecha)).map(({ cobro, fecha }) => ({ mes: mesClave(fecha), capital: cobro.capital, interes: cobro.interes, total: cobro.total })),
    desembolsos: desembolsosTodos.filter((d) => enHistorial(d.fecha)).map(({ desembolso, fecha }) => ({ mes: mesClave(fecha), monto: desembolso.monto })),
    movimientos: movsHistorial.map((x) => ({
      mes: mesClave(dia(x.fecha)),
      tipo: x.tipo,
      monto: x.monto,
      tipoOrigen: x.origen ? (tipoCuenta.get(x.origen) ?? null) : null,
      tipoDestino: x.destino ? (tipoCuenta.get(x.destino) ?? null) : null,
    })),
    castigos: castigosVivos.filter((c) => enHistorial(dia(c.fecha))).map((c) => ({ mes: mesClave(dia(c.fecha)), monto: c.monto })),
  });

  return {
    mes,
    hoy,
    inicioModulo: aperturas[0] ?? null,
    usuario: { id: "padre", nombre: "Padre", capacidades: [...CAPACIDADES] },
    cuentas,
    movimientos,
    cobros: cobrosTodos.filter((c) => enMes(c.fecha)).map((c) => c.cobro),
    desembolsos: desembolsosTodos.filter((d) => enMes(d.fecha)).map((d) => d.desembolso),
    sinCuenta: {
      cobros: cobrosTodos.filter((c) => c.cobro.asignable && c.cobro.cuentaId === null).map((c) => c.cobro),
      desembolsos: desembolsosTodos.filter((d) => d.desembolso.asignable && d.desembolso.cuentaId === null).map((d) => d.desembolso),
    },
    cuotasPorCobrar: pendientes.filter((p) => p.fecha < fin).map((p) => p.cuota),
    tocabaCobrar: {
      cuotas: programadosMes.length,
      pagadas: programadosMes.filter((e) => e.pago).length,
      programado: sumar(programadosMes.map((e) => e.capitalProgramado + e.interesProgramado)),
      capitalProgramado: sumar(programadosMes.map((e) => e.capitalProgramado)),
      interesProgramado: sumar(programadosMes.map((e) => e.interesProgramado)),
      cobradoDeLoProgramado: sumar(programadosMes.map((e) => (e.pago ? e.pago.capital + e.pago.interes : 0))),
    },
    proyeccion: Array.from({ length: 6 }, (_, i) => {
      const clave = sumarMeses(mes, i);
      const del = pendientes.filter((p) => mesClave(p.fecha) === clave).map((p) => p.cuota);
      return { mes: clave, capital: sumar(del.map((c) => c.capital)), interes: sumar(del.map((c) => c.interes)), total: sumar(del.map((c) => c.pendiente)), cuotas: del.length };
    }),
    cartera: { enLaCalle: sumar(vivosCartera.map((c) => c.saldoCapital)), creditosActivos: vivosCartera.length, tramos, creditos: creditosCartera },
    categorias,
    castigos: castigosVivos.map((c) => ({ id: c.id, ...ref(c.creditoId), monto: c.monto, fecha: c.fecha, motivo: c.motivo, version: V })),
    arqueos: [...m.arqueos]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((a) => ({
        id: a.id,
        fecha: a.fecha,
        accionPor: null,
        nota: null,
        detalles: a.detalles.map((d) => ({ ...d, diferencia: d.contado - d.saldoSistema })),
      })),
    historial,
    cierreAnterior,
    configuracion: { metaAsignacionCasa: null, metaAhorro: m.metaAhorro, cuentaAhorroId: m.cuentaAhorroId, version: V, reglas: reglasDe(m) },
    permisos: null,
  };
}

/** `leerCierresAhorro`: the «Pasar al ahorro» movements, voided ones included. */
export function cierresDe(mundo: Mundo, ahora: Date): CierreAhorroRegistro[] {
  const hoy = fechaClave(ahora);
  return mundo.movimientos
    .filter((x) => x.fecha <= hoy && mesDeClaveCierre(x.clave ?? null))
    .map((x) => ({ movimientoId: x.id, mes: mesDeClaveCierre(x.clave!)!, fecha: x.fecha, monto: x.monto, anulado: x.anulado ?? false }));
}

/** `cargarVistaResumen`'s pure input over the world as it was at `ahora`. */
export function leerResumen(mundo: Mundo, ahora: Date, rango: 12 | 24 = 12): DatosResumen {
  const m = corte(mundo, ahora);
  const hoy = fechaClave(ahora);
  const mesActual = hoy.slice(0, 7);
  const nHistoria = Math.max(12, rango);
  const inicioVentana = rangoMes(sumarMeses(mesActual, 1 - nHistoria)).inicio;
  const finActual = rangoMes(mesActual).fin;
  const finProyeccion = rangoMes(sumarMeses(mesActual, 6)).fin;
  const enVentana = (f: Date) => f >= inicioVentana && f < finActual;
  const tipoCuenta = new Map(m.cuentas.map((c) => [c.id, c.tipo]));
  const asientos = asientosDe(m);

  const ahorroFinMes: Record<string, number | null> = {};
  for (let i = nHistoria - 1; i >= 0; i -= 1) {
    const mes = sumarMeses(mesActual, -i);
    const { inicio, fin } = rangoMes(mes);
    const abiertas = m.cuentas.filter((c) => c.tipo === "AHORRO" && dia(c.fechaSaldoInicial) < fin);
    ahorroFinMes[mes] = abiertas.length
      ? aPesos(abiertas.reduce((s, c) => s + aCentavos(resumirSaldo({ id: c.id, saldoInicial: c.saldoInicial, fechaSaldoInicial: dia(c.fechaSaldoInicial) }, asientos, inicio, fin).saldoFin), 0))
      : null;
  }

  return {
    hoy,
    inicioModulo: m.cuentas.map((c) => c.fechaSaldoInicial).sort()[0] ?? null,
    rango,
    cobros: m.eventos.filter((e) => e.pago && enVentana(e.pago.en)).map((e) => ({ ...filaEvento(e), fechaPago: e.pago!.en })),
    programadas: m.eventos
      .filter((e) => e.tipo === "CUOTA_PROGRAMADA" && enVentana(dia(e.fechaProgramada)))
      .map((e) => ({ fechaProgramada: dia(e.fechaProgramada), capitalProgramado: e.capitalProgramado, interesProgramado: e.interesProgramado })),
    pendientes: m.eventos
      .filter((e) => !e.pago && !castigoActivo(m, e.creditoId))
      .filter((e) => dia(e.fechaProgramada) >= finActual && dia(e.fechaProgramada) < finProyeccion)
      .map((e) => ({ fechaProgramada: dia(e.fechaProgramada), capitalProgramado: e.capitalProgramado, interesProgramado: e.interesProgramado, capitalPagado: 0, interesPagado: 0 })),
    movimientos: vivos(m)
      .filter((x) => enVentana(dia(x.fecha)))
      .map((x) => ({
        mes: mesClave(dia(x.fecha)),
        tipo: x.tipo,
        monto: x.monto,
        tipoOrigen: x.origen ? (tipoCuenta.get(x.origen) ?? null) : null,
        tipoDestino: x.destino ? (tipoCuenta.get(x.destino) ?? null) : null,
      })),
    castigos: m.castigos.filter((c) => !c.revertido && enVentana(dia(c.fecha))).map((c) => ({ mes: mesClave(dia(c.fecha)), monto: c.monto })),
    ahorroFinMes,
    tramos: leerMes(mundo, mesActual, ahora).cartera.tramos,
  };
}
