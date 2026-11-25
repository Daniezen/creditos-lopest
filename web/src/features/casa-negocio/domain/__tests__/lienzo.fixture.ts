import type { MesInput } from "../mes";
import type { GastoFijoInput, GastoVariableInput, SaldoCuentaInput } from "../inputs";

/**
 * November 2026 exactly as the approved canvas shows it (Main, Casa, ModuloTabs, Arqueo,
 * Configuración), with "hoy" = 2026-11-25. Tests assert the canvas figures against this.
 */
export const HOY = "2026-11-25";
export const MES = "2026-11";

export const GASTOS_FIJOS: GastoFijoInput[] = [
  { id: "davivienda", nombre: "Crédito Davivienda", monto: 820_000, periodicidad: "MENSUAL", diaPago: 16 },
  { id: "arriendo", nombre: "Arriendo", monto: 1_787_000, periodicidad: "MENSUAL", diaPago: 17 },
  { id: "internet", nombre: "Internet y TV", monto: 120_000, periodicidad: "MENSUAL", diaPago: 20 },
  { id: "funeraria", nombre: "Funeraria", monto: 32_000, periodicidad: "MENSUAL", diaPago: 16 },
  { id: "segBolo", nombre: "Seguros Bolo", monto: 170_000, periodicidad: "MENSUAL", diaPago: 20 },
  { id: "impBolo", nombre: "Impuesto Bolo", monto: 180_000, periodicidad: "ANUAL", mesAnual: 6, diaPago: 15 },
  { id: "soatBolo", nombre: "SOAT Bolo", monto: 660_000, periodicidad: "ANUAL", mesAnual: 8, diaPago: 10 },
  { id: "tecnoBolo", nombre: "Tecnomecánica Bolo", monto: 360_000, periodicidad: "ANUAL", mesAnual: 3, diaPago: 5 },
];

const v = (sobreId: string, fecha: string, monto: number): GastoVariableInput => ({ sobreId, fecha, monto });
export const GASTOS_VARIABLES: GastoVariableInput[] = [
  v("mercado", "2026-11-02", 398_000), v("mercado", "2026-11-09", 400_000), v("mercado", "2026-11-23", 412_000),
  v("epm", "2026-11-12", 312_000),
  v("gasolina", "2026-11-19", 186_000),
  v("salud", "2026-11-21", 72_000),
  v("entretenimiento", "2026-11-14", 60_000),
  v("imprevistos", "2026-11-08", 100_000),
  // October noise that must not leak into November.
  v("mercado", "2026-10-30", 999_000),
];

export const CUENTAS: SaldoCuentaInput[] = [
  { cuentaId: "efectivo", nombre: "Efectivo", ambito: "NEGOCIO", tipo: "EFECTIVO", saldo: 1_320_000 },
  { cuentaId: "banco", nombre: "Bancolombia", ambito: "NEGOCIO", tipo: "BANCO", saldo: 11_900_000 },
  { cuentaId: "nequi", nombre: "Nequi", ambito: "NEGOCIO", tipo: "BILLETERA", saldo: 1_600_000 },
  { cuentaId: "casa", nombre: "Cuenta casa", ambito: "CASA", tipo: "BANCO", saldo: 833_000 },
  { cuentaId: "nu", nombre: "Nu · ahorro", ambito: "CASA", tipo: "AHORRO", saldo: 7_006_000 },
];

/** Splits `total` among `n` items: equal parts, remainder on the first, all integers. */
export function repartir(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? total - base * (n - 1) : base));
}

const cobros = (fecha: string, total: number, n: number) =>
  repartir(total, n).map((monto, i) => ({ creditoId: `c-${fecha}-${i}`, fecha, monto }));
const cuotas = (fecha: string, total: number, n: number) =>
  repartir(total, n).map((pendiente, i) => ({ creditoId: `k-${fecha}-${i}`, fechaProgramada: fecha, pendiente }));

export const NOVIEMBRE: MesInput = {
  mes: MES,
  hoy: HOY,
  negocio: {
    interesesCobrados: 6_240_000, capitalCobrado: 9_800_000, gastos: 180_000, perdidos: 0,
    retirosCasa: 5_500_000, desembolsos: 3_000_000, aportes: 0,
  },
  casaIngresos: { retirosRecibidos: 5_500_000, ingresosExtra: 0 },
  gastosFijos: GASTOS_FIJOS,
  pagosFijos: [
    { gastoId: "davivienda", fecha: "2026-11-16", monto: 820_000 },
    { gastoId: "arriendo", fecha: "2026-11-17", monto: 1_787_000 },
    { gastoId: "internet", fecha: "2026-11-20", monto: 120_000 },
  ],
  sobres: [
    { id: "mercado", nombre: "Mercado", tope: 2_700_000 },
    { id: "epm", nombre: "EPM", tope: 470_000 },
    { id: "gasolina", nombre: "Gasolina", tope: 200_000 },
    { id: "salud", nombre: "Salud", tope: 50_000 },
    { id: "entretenimiento", nombre: "Entretenimiento", tope: 150_000 },
    { id: "imprevistos", nombre: "Imprevistos", tope: 500_000 },
  ],
  gastosVariables: GASTOS_VARIABLES,
  cobrosHechos: [
    ...cobros("2026-11-01", 2_140_000, 6), ...cobros("2026-11-05", 1_380_000, 4), ...cobros("2026-11-10", 2_600_000, 7),
    ...cobros("2026-11-15", 1_910_000, 5),
  ],
  cuotas: [
    ...cuotas("2026-11-25", 1_720_000, 5), ...cuotas("2026-11-27", 600_000, 2),
    // A cuota already settled: must not appear as "por cobrar".
    { creditoId: "pagada", fechaProgramada: "2026-11-27", pendiente: 0 },
  ],
  retiros: [
    { id: "r1", fecha: "2026-11-01", monto: 3_000_000, cuentaOrigen: "Bancolombia", cuentaDestino: "Cuenta casa" },
    { id: "r2", fecha: "2026-11-24", monto: 2_500_000, cuentaOrigen: "Bancolombia", cuentaDestino: "Cuenta casa" },
  ],
};
