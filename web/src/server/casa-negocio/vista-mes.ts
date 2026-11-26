/**
 * Bridge between the read contract (`CasaNegocioMes`, from `queries.ts`) and
 * the pure calculation engine (`@/features/casa-negocio/domain`).
 *
 * PURE MODULE: no Prisma, no NextAuth, no React. It only maps plain data to
 * plain data, so every tab (and its tests) can run the engine over a month
 * fixture without a database. The server loader that feeds it lives in
 * `vista-encabezado.ts` (`cargarVistaMes`).
 *
 * WHY A BRIDGE. The two contracts were built in parallel and differ on
 * purpose in three places, all resolved here and only here:
 *   1. Money: the read side allows two decimals; the engine demands integer
 *      pesos (`assertPesos`). COP has no cents in practice, so we round.
 *   2. Alert codes: the database enum (`FIJO_VENCIDO_SIN_PAGAR`, ...) and the
 *      engine ids (`FIJO_VENCIDO`, ...) have different spellings.
 *   3. Shapes: the engine wants fixed expenses, envelopes, payments and
 *      counting history as its own input types (see `domain/inputs.ts`).
 */
import {
  calcularCuentasCasa,
  calcularFijosDelMes,
  calcularMes,
  evaluarAvisos,
  fijosSinPagar,
  mesDe,
  sumarMeses,
  type Aviso,
  type CierreMesInput,
  type ConfigAvisos,
  type CreditoCarteraInput,
  type CuentaConteoInput,
  type GastoFijoInput,
  type MesCalculado,
  type MesInput,
  type PagoFijoInput,
  type ReglaAvisoId,
} from "@/features/casa-negocio/domain";
import type { CasaNegocioMes, CodigoAviso, TipoMovimiento } from "@/features/casa-negocio/types";
import { fechaClave } from "@/features/casa-negocio/mes";

/** Database alert code → engine rule id (spec §5, same order). */
export const REGLA_DE_CODIGO: Record<CodigoAviso, ReglaAvisoId> = {
  FIJO_VENCIDO_SIN_PAGAR: "FIJO_VENCIDO",
  SOBRE_CERCA_DEL_TOPE: "SOBRE_CERCA_TOPE",
  SOBRES_CIERRE_NEGATIVO: "SOBRES_CIERRE_NEGATIVO",
  CUENTA_SIN_CONTAR: "CUENTA_SIN_CONTAR",
  ARQUEO_NO_CUADRA: "ARQUEO_NO_CUADRA",
  RETIRO_SUPERA_GANANCIA: "RETIRO_MAYOR_GANANCIA",
  MOVIMIENTO_DEJA_SIN_SALDO: "CUENTA_SIN_SALDO",
  CREDITO_SIN_PAGOS: "CREDITO_SIN_PAGOS",
  GASTO_ANUAL_PROXIMO: "ANUAL_POR_VENCER",
  CIERRE_SOBRANTE_SIN_AHORRO: "CIERRE_SIN_AHORRO",
};

/** Whole pesos for the engine (the read side may carry two decimals). */
export const entero = (value: number): number => Math.round(value);

const sumaEntera = (values: readonly number[]) => values.reduce((total, value) => total + entero(value), 0);

/**
 * Saved alert configuration in the engine's shape. A rule missing from the
 * database falls back to the engine default (active, default threshold); a
 * stored `umbral` of null also keeps the default.
 */
export function configAvisosDe(datos: Pick<CasaNegocioMes, "configuracion">): ConfigAvisos {
  const config: ConfigAvisos = {};
  for (const regla of datos.configuracion.reglas) {
    config[REGLA_DE_CODIGO[regla.codigo]] = { activa: regla.activa, umbral: regla.umbral ?? undefined };
  }
  return config;
}

/** True unless the rule was switched off in Configuración. */
export function reglaActiva(config: ConfigAvisos, regla: ReglaAvisoId): boolean {
  return config[regla]?.activa ?? true;
}

function movimientosDe(datos: Pick<CasaNegocioMes, "movimientos">, tipo: TipoMovimiento) {
  return datos.movimientos.filter((m) => m.tipo === tipo);
}

/**
 * Fixed expenses the engine can evaluate. Active FIJO categories only; an
 * expense without a payment day is due on the month's last day (31 is
 * clamped by the engine), and an annual one without its month is skipped
 * because it has no occurrence to place.
 */
export function gastosFijosDe(datos: Pick<CasaNegocioMes, "categorias">): GastoFijoInput[] {
  return datos.categorias
    .filter((c) => c.clase === "FIJO" && c.activa)
    .filter((c) => c.periodicidad === "MENSUAL" || (c.mesAnual !== null && c.mesAnual >= 1 && c.mesAnual <= 12))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      monto: entero(c.monto ?? 0),
      periodicidad: c.periodicidad,
      mesAnual: c.mesAnual ?? undefined,
      diaPago: c.diaPago ?? 31,
    }));
}

/** Payments against fixed expenses recorded in the month. */
export function pagosFijosDe(datos: Pick<CasaNegocioMes, "movimientos">): PagoFijoInput[] {
  return movimientosDe(datos, "GASTO_FIJO")
    .filter((m) => m.categoriaId !== null)
    .map((m) => ({ gastoId: m.categoriaId!, fecha: m.fecha, monto: entero(m.monto) }));
}

/** Engine input for one month, from the read contract. */
export function entradaMotor(datos: CasaNegocioMes, config: ConfigAvisos = configAvisosDe(datos)): MesInput {
  const { mes, hoy } = datos;
  const nombreCuenta = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const retiros = movimientosDe(datos, "RETIRO_CASA");
  const retirosCasa = sumaEntera(retiros.map((m) => m.monto));

  return {
    mes,
    hoy,
    negocio: {
      interesesCobrados: sumaEntera(datos.cobros.map((c) => c.interes)),
      capitalCobrado: sumaEntera(datos.cobros.map((c) => c.capital)),
      gastos: sumaEntera(movimientosDe(datos, "GASTO_NEGOCIO").map((m) => m.monto)),
      perdidos: sumaEntera(datos.castigos.filter((c) => mesDe(c.fecha) === mes).map((c) => c.monto)),
      retirosCasa,
      desembolsos: sumaEntera(datos.desembolsos.map((d) => d.monto)),
      aportes: sumaEntera(movimientosDe(datos, "APORTE").map((m) => m.monto)),
    },
    casaIngresos: {
      retirosRecibidos: retirosCasa,
      ingresosExtra: sumaEntera(movimientosDe(datos, "INGRESO_CASA").map((m) => m.monto)),
    },
    gastosFijos: gastosFijosDe(datos),
    pagosFijos: pagosFijosDe(datos),
    // Envelopes are the active variable expenses that have a cap; spending in
    // a variable expense without a cap still counts as "Variables" (sin sobre).
    sobres: datos.categorias
      .filter((c) => c.clase === "VARIABLE" && c.activa && c.monto !== null)
      .map((c) => ({ id: c.id, nombre: c.nombre, tope: entero(c.monto!) })),
    gastosVariables: movimientosDe(datos, "GASTO_VARIABLE").map((m) => ({
      sobreId: m.categoriaId,
      fecha: m.fecha,
      monto: entero(m.monto),
    })),
    cobrosHechos: datos.cobros.map((c) => ({ creditoId: c.creditoId, fecha: c.fechaPago, monto: entero(c.total) })),
    cuotas: datos.cuotasPorCobrar.map((c) => ({
      creditoId: c.creditoId,
      fechaProgramada: c.fechaProgramada,
      pendiente: entero(c.pendiente),
    })),
    retiros: retiros.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      monto: entero(m.monto),
      cuentaOrigen: (m.cuentaOrigenId && nombreCuenta.get(m.cuentaOrigenId)) || "Negocio",
      cuentaDestino: (m.cuentaDestinoId && nombreCuenta.get(m.cuentaDestinoId)) || "Casa",
    })),
    umbralSobre: config.SOBRE_CERCA_TOPE?.umbral,
  };
}

/**
 * Counting history per active account (rules 4 and 5). The difference of the
 * last count comes from the recent arqueos list; an account whose last count
 * is older than that list is taken as balanced (the list keeps 24 arqueos).
 */
export function conteosDe(datos: CasaNegocioMes): CuentaConteoInput[] {
  return datos.cuentas
    .filter((c) => !c.archivada)
    .map((c) => {
      let ultimoArqueo: CuentaConteoInput["ultimoArqueo"] = null;
      if (c.ultimoArqueo) {
        // `arqueos` is most recent first: the first one counting this account is its last count.
        const detalle = datos.arqueos.flatMap((a) => a.detalles).find((d) => d.cuentaId === c.id);
        ultimoArqueo = { fecha: fechaClave(new Date(c.ultimoArqueo)), diferencia: entero(detalle?.diferencia ?? 0) };
      }
      return { cuentaId: c.id, nombre: c.nombre, desde: c.fechaSaldoInicial, ultimoArqueo };
    });
}

/**
 * Active credits for rule 8. The read side measures "days without payments"
 * from the last payment or, if none, from the loan date; the engine wants a
 * start day, so a never-paid credit starts its clock on `hoy − diasSinPago`
 * (its loan date). That is a few weeks earlier than the first scheduled cuota
 * the engine would prefer, a conservative difference for a 90-day rule.
 */
export function creditosAviso(datos: CasaNegocioMes): CreditoCarteraInput[] {
  const desdeDias = (dias: number) => {
    const [anio, mes, dia] = datos.hoy.split("-").map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10);
  };
  return datos.cartera.creditos
    .filter((c) => !c.castigado)
    .map((c) => ({
      creditoId: c.creditoId,
      saldoCapital: entero(c.saldoCapital),
      cuotaVencidaMasAntigua: null,
      ultimoPago: c.ultimoPago,
      primeraCuota: c.ultimoPago ? null : desdeDias(c.diasSinPago),
    }));
}

/**
 * House «al cierre» of one month (spec §3: entró − fijos − variables − fijos
 * sin pagar), from that month's movements and categories, with the same
 * engine functions and mappings `calcularMes` uses. This is the leftover the
 * Ahorro tab proposes to pass (`sobranteCasa`), so rule 10 on the Tablero and
 * the cierre card in Ahorro always speak of the same amount. Envelopes do not
 * enter: what is left in them is not money spent.
 */
export function alCierreCasa(
  mes: string,
  hoy: string,
  datos: Pick<CasaNegocioMes, "movimientos" | "categorias">,
): number {
  const suma = (tipo: TipoMovimiento) => sumaEntera(movimientosDe(datos, tipo).map((m) => m.monto));
  const pagos = pagosFijosDe(datos);
  const fijos = calcularFijosDelMes(gastosFijosDe(datos), pagos, mes, hoy);
  return calcularCuentasCasa({
    ingresos: { retirosRecibidos: suma("RETIRO_CASA"), ingresosExtra: suma("INGRESO_CASA") },
    // Cash view, like the casa equation: every GASTO_FIJO of the month.
    fijos: suma("GASTO_FIJO"),
    variables: suma("GASTO_VARIABLE"),
    fijosSinPagar: fijosSinPagar(fijos),
    quedaEnSobres: 0,
  }).alCierre;
}

/**
 * Rule 10 looks at the month that ended most recently (the one before
 * today's), so it is only evaluated when the month shown is today's.
 *
 * The figures come from `datos.cierreAnterior`, which the read
 * (`queries.ts`) computes for exactly that month: the leftover is its house
 * «al cierre» (`alCierreCasa`, the amount Ahorro proposes) and what reached
 * savings is the sum of its live «Pasar al ahorro» movements (the cierre
 * idempotency keys), the same thing Ahorro calls «hecho». A plain Traslado
 * into the savings account is not a cierre in either tab.
 *
 * Fallback for reads built without that field (older fixtures): the month's
 * cash from the history, which ignores unpaid fixed expenses and counts
 * every deposit into savings. It never runs on the real read.
 */
export function cierreAnteriorDe(datos: CasaNegocioMes): CierreMesInput | null {
  const mesHoy = datos.hoy.slice(0, 7);
  if (datos.mes !== mesHoy) return null;
  const anterior = sumarMeses(mesHoy, -1);
  // Before the module started there is no house ledger: nothing to close.
  if (datos.inicioModulo && datos.inicioModulo.slice(0, 7) > anterior) return null;
  if (datos.cierreAnterior !== undefined) {
    const c = datos.cierreAnterior;
    if (!c || c.mes !== anterior) return null;
    return { mes: c.mes, sobrante: entero(c.sobrante), pasadoAlAhorro: entero(c.pasadoAlAhorro) };
  }
  const previo = datos.historial.find((h) => h.mes === anterior);
  const actual = datos.historial.find((h) => h.mes === mesHoy);
  if (!previo) return null;
  return {
    mes: anterior,
    sobrante: entero(previo.retirosCasa + previo.ingresosCasa - previo.gastosFijos - previo.gastosVariables),
    pasadoAlAhorro: entero(previo.depositosAhorro + (actual?.depositosAhorro ?? 0)),
  };
}

export interface MesEvaluado {
  calculo: MesCalculado;
  avisos: Aviso[];
  config: ConfigAvisos;
}

/** Runs the engine and the alert evaluator over one month of the read contract. */
export function evaluarMes(datos: CasaNegocioMes): MesEvaluado {
  const config = configAvisosDe(datos);
  const entrada = entradaMotor(datos, config);
  const calculo = calcularMes(entrada);
  const avisos = evaluarAvisos(
    {
      mes: datos.mes,
      hoy: datos.hoy,
      fijos: calculo.fijos,
      sobres: calculo.sobres.sobres,
      casa: calculo.casa,
      cuentas: conteosDe(datos),
      negocio: calculo.negocio,
      creditos: creditosAviso(datos),
      gastosFijos: entrada.gastosFijos,
      pagosFijos: entrada.pagosFijos,
      cierreAnterior: cierreAnteriorDe(datos),
    },
    config,
  );
  return { calculo, avisos, config };
}
