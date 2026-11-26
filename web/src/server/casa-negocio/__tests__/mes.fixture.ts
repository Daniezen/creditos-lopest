import type {
  CasaNegocioMes,
  CategoriaMes,
  CobroMes,
  CuentaMes,
  HistorialMes,
  MovimientoManual,
  ReglaAviso,
} from "@/features/casa-negocio/types";
import { CODIGOS_AVISO } from "@/features/casa-negocio/schemas";

/**
 * A small but complete month of the read contract (December 2026 seen on the
 * 20th), shaped like `cargarCasaNegocioMes` returns it, for the view-model
 * tests. Builders take overrides so each test changes only what it is about.
 */

const V = "2026-12-01T05:00:00.000Z";

export function cuenta(over: Partial<CuentaMes> & Pick<CuentaMes, "id" | "nombre" | "grupo">): CuentaMes {
  return {
    tipo: "BANCO",
    orden: 0,
    archivada: false,
    saldoInicial: 0,
    fechaSaldoInicial: "2026-12-01",
    saldoInicioMes: 0,
    entradasMes: 0,
    salidasMes: 0,
    saldoFinMes: 0,
    saldoActual: 0,
    ultimoArqueo: null,
    version: V,
    ...over,
  };
}

export function categoria(over: Partial<CategoriaMes> & Pick<CategoriaMes, "id" | "nombre" | "clase">): CategoriaMes {
  return {
    monto: null,
    periodicidad: "MENSUAL",
    mesAnual: null,
    diaPago: null,
    activa: true,
    orden: 0,
    gastadoMes: 0,
    movimientosMes: 0,
    venceEnMes: true,
    fechaPagoMes: null,
    pagadoMes: false,
    proximoVencimiento: null,
    version: V,
    ...over,
  };
}

let n = 0;
export function movimiento(over: Partial<MovimientoManual> & Pick<MovimientoManual, "tipo" | "monto" | "fecha">): MovimientoManual {
  n += 1;
  return {
    id: `mov-${n}`,
    cuentaOrigenId: null,
    cuentaDestinoId: null,
    categoriaId: null,
    nota: null,
    accionPor: null,
    creadoEn: V,
    version: V,
    ...over,
  };
}

export function cobro(over: Partial<CobroMes> & Pick<CobroMes, "fechaPago" | "capital" | "interes">): CobroMes {
  n += 1;
  return {
    eventoFinancieroId: `ev-${n}`,
    creditoId: `cr-${n}`,
    creditoCodigo: `C-${n}`,
    clienteNombre: "Cliente",
    dueno: null,
    esPropio: true,
    tipo: "CUOTA",
    numeroCuota: 1,
    total: over.capital + over.interes,
    cuentaId: "bancolombia",
    asignacionVersion: null,
    asignable: true,
    ...over,
  };
}

function historialVacio(mes: string): HistorialMes {
  return {
    mes,
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

export function reglas(over: Partial<Record<(typeof CODIGOS_AVISO)[number], Partial<ReglaAviso>>> = {}): ReglaAviso[] {
  return CODIGOS_AVISO.map((codigo) => ({ codigo, activa: true, umbral: null, version: V, ...over[codigo] }));
}

/** December 2026 on the 20th: two business accounts, one house account, one savings account. */
export function mesDiciembre(over: Partial<CasaNegocioMes> = {}): CasaNegocioMes {
  const cuentas = [
    cuenta({ id: "bancolombia", nombre: "Bancolombia", grupo: "NEGOCIO", saldoFinMes: 11_900_000, saldoActual: 11_900_000 }),
    cuenta({
      id: "nequi",
      nombre: "Nequi",
      grupo: "NEGOCIO",
      tipo: "BILLETERA",
      saldoFinMes: 1_600_000,
      saldoActual: 1_600_000,
      ultimoArqueo: "2026-12-18T15:00:00.000Z",
    }),
    cuenta({ id: "casa", nombre: "Cuenta casa", grupo: "CASA", saldoFinMes: 833_000, saldoActual: 833_000 }),
    cuenta({ id: "nu", nombre: "Nu", grupo: "CASA", tipo: "AHORRO", saldoFinMes: 7_006_000, saldoActual: 7_006_000 }),
  ];
  return {
    mes: "2026-12",
    hoy: "2026-12-20",
    inicioModulo: "2026-12-01",
    usuario: { id: "u1", nombre: "Padre", capacidades: ["VER", "ANOTAR", "CONTAR", "CONFIGURAR"] },
    cuentas,
    movimientos: [
      movimiento({ tipo: "RETIRO_CASA", monto: 3_000_000, fecha: "2026-12-01", cuentaOrigenId: "bancolombia", cuentaDestinoId: "casa" }),
      movimiento({ tipo: "GASTO_NEGOCIO", monto: 180_000, fecha: "2026-12-03", cuentaOrigenId: "bancolombia", nota: "Papelería" }),
      movimiento({ tipo: "GASTO_FIJO", monto: 1_787_000, fecha: "2026-12-17", cuentaOrigenId: "casa", categoriaId: "arriendo" }),
      movimiento({ tipo: "GASTO_VARIABLE", monto: 186_000, fecha: "2026-12-10", cuentaOrigenId: "casa", categoriaId: "gasolina" }),
    ],
    cobros: [cobro({ fechaPago: "2026-12-05", capital: 800_000, interes: 200_000 })],
    desembolsos: [],
    sinCuenta: { cobros: [], desembolsos: [] },
    cuotasPorCobrar: [
      {
        eventoFinancieroId: "pend-1",
        creditoId: "cr-p",
        creditoCodigo: "C-P",
        clienteNombre: "Cliente P",
        dueno: null,
        esPropio: true,
        numeroCuota: 3,
        fechaProgramada: "2026-12-27",
        estado: "PENDIENTE",
        pendiente: 600_000,
        capital: 500_000,
        interes: 100_000,
        diasAtraso: 0,
        vencida: false,
      },
    ],
    tocabaCobrar: { cuotas: 0, pagadas: 0, programado: 0, capitalProgramado: 0, interesProgramado: 0, cobradoDeLoProgramado: 0 },
    proyeccion: [],
    cartera: { enLaCalle: 186_400_000, creditosActivos: 42, tramos: [], creditos: [] },
    categorias: [
      categoria({ id: "arriendo", nombre: "Arriendo", clase: "FIJO", monto: 1_787_000, diaPago: 17 }),
      categoria({ id: "funeraria", nombre: "Funeraria", clase: "FIJO", monto: 32_000, diaPago: 16 }),
      categoria({ id: "gasolina", nombre: "Gasolina", clase: "VARIABLE", monto: 200_000 }),
      categoria({ id: "mercado", nombre: "Mercado", clase: "VARIABLE", monto: 2_700_000 }),
    ],
    castigos: [],
    arqueos: [
      {
        id: "arq-1",
        fecha: "2026-12-18T15:00:00.000Z",
        accionPor: null,
        nota: null,
        detalles: [{ cuentaId: "nequi", saldoSistema: 1_650_000, contado: 1_600_000, diferencia: -50_000 }],
      },
    ],
    historial: [historialVacio("2026-11"), historialVacio("2026-12")],
    configuracion: { metaAsignacionCasa: null, metaAhorro: null, cuentaAhorroId: "nu", version: V, reglas: reglas() },
    permisos: null,
    ...over,
  };
}
