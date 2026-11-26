/**
 * A December month read (`CasaNegocioMes`) for the Casa/Negocio view-model
 * and render tests: three accounts, fixed and variable household expenses,
 * a business retiro, a traslado, one assigned and one unassigned cobro and an
 * unassigned disbursement, one arqueo that did not match.
 */
import type { CasaNegocioMes, CategoriaMes, CuentaMes, MovimientoManual } from "@/features/casa-negocio/types";

export const V = "2026-12-01T12:00:00.000Z";

export function cuenta(id: string, nombre: string, grupo: CuentaMes["grupo"], saldoFinMes: number, extra: Partial<CuentaMes> = {}): CuentaMes {
  return {
    id, nombre, grupo, tipo: "BANCO", orden: 0, archivada: false,
    saldoInicial: 0, fechaSaldoInicial: "2026-12-01",
    saldoInicioMes: 0, entradasMes: 0, salidasMes: 0,
    saldoFinMes, saldoActual: saldoFinMes, ultimoArqueo: null, version: V, ...extra,
  };
}

function categoria(id: string, nombre: string, clase: CategoriaMes["clase"], monto: number | null, extra: Partial<CategoriaMes> = {}): CategoriaMes {
  return {
    id, nombre, clase, monto, periodicidad: "MENSUAL", mesAnual: null, diaPago: null, activa: true, orden: 0,
    gastadoMes: 0, movimientosMes: 0, venceEnMes: true, fechaPagoMes: null, pagadoMes: false, proximoVencimiento: null,
    version: V, ...extra,
  };
}

let n = 0;
function mov(tipo: MovimientoManual["tipo"], fecha: string, monto: number, extra: Partial<MovimientoManual> = {}): MovimientoManual {
  n += 1;
  return {
    id: `m${n}`, tipo, fecha, monto, cuentaOrigenId: null, cuentaDestinoId: null, categoriaId: null, nota: null,
    accionPor: null, creadoEn: `2026-12-${fecha.slice(8, 10)}T15:00:0${n % 10}.000Z`, version: V, ...extra,
  };
}

export function mes(extra: Partial<CasaNegocioMes> = {}): CasaNegocioMes {
  return {
    mes: "2026-12",
    hoy: "2026-12-20",
    inicioModulo: "2026-12-01",
    usuario: { id: "u1", nombre: "Padre", capacidades: ["VER", "ANOTAR"] },
    cuentas: [
      cuenta("banco", "Bancolombia", "NEGOCIO", 10_000_000),
      cuenta("efectivo", "Efectivo", "NEGOCIO", 1_000_000),
      cuenta("casa", "Cuenta casa", "CASA", 2_000_000),
    ],
    movimientos: [
      mov("RETIRO_CASA", "2026-12-01", 3_000_000, { cuentaOrigenId: "banco", cuentaDestinoId: "casa" }),
      mov("GASTO_FIJO", "2026-12-05", 1_787_000, { cuentaOrigenId: "casa", categoriaId: "arriendo" }),
      mov("GASTO_VARIABLE", "2026-12-05", 186_000, { cuentaOrigenId: "casa", categoriaId: "gasolina", nota: "Tanqueo" }),
      mov("INGRESO_CASA", "2026-12-08", 400_000, { cuentaDestinoId: "casa", nota: "Regalo" }),
      mov("GASTO_NEGOCIO", "2026-12-10", 45_000, { cuentaOrigenId: "efectivo", nota: "Papelería" }),
      mov("TRASLADO", "2026-12-12", 500_000, { cuentaOrigenId: "efectivo", cuentaDestinoId: "banco" }),
    ],
    cobros: [
      {
        eventoFinancieroId: "ev1", creditoId: "c1", creditoCodigo: "LP-1", clienteNombre: "Ana", dueno: { id: "u1", nombre: "Padre" }, esPropio: true,
        tipo: "CUOTA", numeroCuota: 4, fechaPago: "2026-12-11", capital: 380_000, interes: 95_000, total: 475_000,
        cuentaId: "banco", asignacionVersion: V, asignable: true,
      },
      {
        eventoFinancieroId: "ev2", creditoId: "c2", creditoCodigo: "LP-2", clienteNombre: "Beto", dueno: { id: "u2", nombre: "María" }, esPropio: false,
        tipo: "CUOTA", numeroCuota: 9, fechaPago: "2026-12-15", capital: 500_000, interes: 120_000, total: 620_000,
        cuentaId: null, asignacionVersion: null, asignable: true,
      },
    ],
    desembolsos: [
      {
        creditoId: "c3", creditoCodigo: "LP-3", clienteNombre: "Caro", dueno: { id: "u1", nombre: "Padre" }, esPropio: true,
        fecha: "2026-12-14", monto: 3_000_000, cuentaId: null, asignacionVersion: null, asignable: true,
      },
    ],
    sinCuenta: { cobros: [], desembolsos: [] },
    cuotasPorCobrar: [],
    tocabaCobrar: { cuotas: 0, pagadas: 0, programado: 0, capitalProgramado: 0, interesProgramado: 0, cobradoDeLoProgramado: 0 },
    proyeccion: [],
    cartera: { enLaCalle: 0, creditosActivos: 0, tramos: [], creditos: [] },
    categorias: [
      categoria("arriendo", "Arriendo", "FIJO", 1_787_000, { diaPago: 5 }),
      categoria("seguros", "Seguros Bolo", "FIJO", 170_000, { diaPago: 15 }),
      categoria("internet", "Internet y TV", "FIJO", 120_000, { diaPago: 28 }),
      categoria("soat", "SOAT Bolo", "FIJO", 660_000, { periodicidad: "ANUAL", mesAnual: 8, diaPago: 10 }),
      categoria("gasolina", "Gasolina", "VARIABLE", 200_000),
      categoria("mercado", "Mercado", "VARIABLE", 2_700_000),
    ],
    castigos: [],
    arqueos: [
      { id: "a1", fecha: "2026-12-18T20:00:00.000Z", accionPor: null, nota: null, detalles: [{ cuentaId: "efectivo", saldoSistema: 1_000_000, contado: 950_000, diferencia: -50_000 }] },
    ],
    historial: [],
    configuracion: { metaAsignacionCasa: null, metaAhorro: null, cuentaAhorroId: null, version: V, reglas: [] },
    permisos: null,
    ...extra,
  };
}

