/**
 * A small, valid `CasaNegocioMes` for the Ahorro and Arqueo view-model tests:
 * November 2026, today the 25th, the canvas accounts (three of Negocio, the
 * household account and the Nu savings account). Each test overrides what it
 * looks at.
 */
import type { CasaNegocioMes, CuentaMes, HistorialMes, ReglaAviso } from "@/features/casa-negocio/types";
import { CODIGOS_AVISO } from "@/features/casa-negocio/schemas";

const V = "2026-11-01T05:00:00.000Z";

export function cuenta(id: string, nombre: string, grupo: CuentaMes["grupo"], saldo: number, extra: Partial<CuentaMes> = {}): CuentaMes {
  return {
    id,
    nombre,
    grupo,
    tipo: "BANCO",
    orden: 0,
    archivada: false,
    saldoInicial: saldo,
    fechaSaldoInicial: "2026-11-01",
    saldoInicioMes: saldo,
    entradasMes: 0,
    salidasMes: 0,
    saldoFinMes: saldo,
    saldoActual: saldo,
    ultimoArqueo: null,
    version: V,
    ...extra,
  };
}

export function historial(hasta = "2026-11", valores: Partial<Record<string, Partial<HistorialMes>>> = {}): HistorialMes[] {
  const [anio, mes] = hasta.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(anio, mes - 1 - (11 - i), 1));
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      mes: clave,
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
      ...valores[clave],
    };
  });
}

export function reglas(overrides: Partial<Record<ReglaAviso["codigo"], Partial<ReglaAviso>>> = {}): ReglaAviso[] {
  return CODIGOS_AVISO.map((codigo) => ({ codigo, activa: true, umbral: null, version: V, ...overrides[codigo] }));
}

export function mesFixture(overrides: Partial<CasaNegocioMes> = {}): CasaNegocioMes {
  return {
    mes: "2026-11",
    hoy: "2026-11-25",
    inicioModulo: "2026-11-01",
    usuario: { id: "u1", nombre: "Padre", capacidades: ["VER", "ANOTAR", "CONTAR", "CONFIGURAR"] },
    cuentas: [
      cuenta("efectivo", "Efectivo", "NEGOCIO", 1_320_000, { tipo: "EFECTIVO" }),
      cuenta("banco", "Bancolombia", "NEGOCIO", 11_900_000),
      cuenta("nequi", "Nequi", "NEGOCIO", 1_600_000, { tipo: "BILLETERA" }),
      cuenta("casa", "Cuenta casa", "CASA", 833_000),
      cuenta("nu", "Nu · ahorro", "CASA", 7_006_000, { tipo: "AHORRO" }),
    ],
    movimientos: [],
    cobros: [],
    desembolsos: [],
    sinCuenta: { cobros: [], desembolsos: [] },
    cuotasPorCobrar: [],
    tocabaCobrar: { cuotas: 0, pagadas: 0, programado: 0, capitalProgramado: 0, interesProgramado: 0, cobradoDeLoProgramado: 0 },
    proyeccion: [],
    cartera: { enLaCalle: 0, creditosActivos: 0, tramos: [], creditos: [] },
    categorias: [],
    castigos: [],
    arqueos: [],
    historial: historial(),
    configuracion: { metaAsignacionCasa: null, metaAhorro: 20_000_000, cuentaAhorroId: "nu", version: V, reglas: reglas() },
    permisos: null,
    ...overrides,
  };
}

/** A manual movement of the fixture month. */
export function movimiento(id: string, tipo: CasaNegocioMes["movimientos"][number]["tipo"], monto: number, fecha = "2026-11-10") {
  return {
    id,
    tipo,
    fecha,
    monto,
    cuentaOrigenId: null,
    cuentaDestinoId: null,
    categoriaId: null,
    nota: null,
    accionPor: null,
    creadoEn: V,
    version: V,
  };
}
