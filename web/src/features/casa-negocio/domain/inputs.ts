/**
 * Input contract of the Casa y Negocio calculation engine.
 *
 * Every type here is deliberately plain (strings, integers, booleans) so the engine stays
 * pure: no Prisma `Decimal`, no `Date`, no React. The data layer (`web/src/server/casa-negocio/`)
 * is responsible for mapping query rows into these shapes:
 *
 * - Money is `Pesos`: an integer amount of Colombian pesos. COP has no cents in practice and
 *   Lopest already stores credit amounts as whole pesos, so integers keep every sum exact.
 *   Convert a Prisma `Decimal` with `decimal.toNumber()` only after checking it is whole
 *   (`assertPesos` in `money.ts` throws otherwise, so a stray fraction never hides).
 * - Calendar days are `DiaISO` ("2026-11-25") already resolved in America/Bogota. Use
 *   `diaBogota(instant)` from `dates.ts` to convert a `Date`/timestamp. Working with day keys
 *   instead of `Date` removes every timezone ambiguity from the engine itself.
 * - Months are `MesISO` ("2026-11").
 */

/** Integer amount of Colombian pesos. Negative only where a field says so. */
export type Pesos = number;

/** Calendar day in America/Bogota, formatted `YYYY-MM-DD`. */
export type DiaISO = string;

/** Calendar month, formatted `YYYY-MM`. */
export type MesISO = string;

export type Ambito = "NEGOCIO" | "CASA";
export type TipoCuenta = "EFECTIVO" | "BANCO" | "BILLETERA" | "AHORRO";

// ---------------------------------------------------------------------------
// Las cuentas del mes (spec §3)
// ---------------------------------------------------------------------------

/**
 * Business totals for one month. All amounts are cash that moved inside the month
 * (by the day it happened in Bogota), never accrued values: spec §3 says
 * "Ganancia = intereses cobrados en el mes (caja), no causados".
 */
export interface NegocioMesInput {
  /** Interest portion of every cuota/abono paid in the month (from `EventoFinanciero`). */
  interesesCobrados: Pesos;
  /** Capital portion of every cuota/abono paid in the month ("capital que devolvieron"). */
  capitalCobrado: Pesos;
  /** Manual "gasto del negocio" movements. */
  gastos: Pesos;
  /** Capital written off (préstamo perdido) with castigo date inside the month, net of reversals. */
  perdidos: Pesos;
  /** "Retiro a la casa": transfers from a NEGOCIO account to a CASA account. */
  retirosCasa: Pesos;
  /** New loans disbursed in the month (from `Credito`). */
  desembolsos: Pesos;
  /** "Aporte de capital" movements into the business. */
  aportes: Pesos;
}

/** House money that came in during the month. */
export interface CasaIngresosInput {
  /** Retiros del negocio received by CASA accounts. Normally equals `NegocioMesInput.retirosCasa`. */
  retirosRecibidos: Pesos;
  /** "Ingreso de la casa" movements (rent received, gifts, …). */
  ingresosExtra: Pesos;
}

/** Account balance as Lopest computes it (initial balance + every movement up to now). */
export interface SaldoCuentaInput {
  cuentaId: string;
  nombre: string;
  ambito: Ambito;
  tipo: TipoCuenta;
  saldo: Pesos;
}

/** Portfolio still lent out ("En la calle"). Shown next to the family total, never added to it. */
export interface CarteraInput {
  capitalPendiente: Pesos;
  creditosActivos: number;
}

// ---------------------------------------------------------------------------
// Fijos y sobres
// ---------------------------------------------------------------------------

export type Periodicidad = "MENSUAL" | "ANUAL";

/** A fixed house expense as configured in Configuración. */
export interface GastoFijoInput {
  id: string;
  nombre: string;
  /** Expected amount per occurrence. */
  monto: Pesos;
  periodicidad: Periodicidad;
  /** 1–12; required when `periodicidad === "ANUAL"`, ignored otherwise. */
  mesAnual?: number;
  /** 1–31; clamped to the month's last day (31 → 30 in November, → 28/29 in February). */
  diaPago: number;
}

/** A payment against a fixed expense. */
export interface PagoFijoInput {
  gastoId: string;
  /** Day the money left the account: decides which month's "Fijos" total it lands in. */
  fecha: DiaISO;
  monto: Pesos;
  /**
   * Occurrence this payment settles. Defaults to the month of `fecha`. Lets a late
   * October payment made on Nov 2 mark October as paid instead of November.
   */
  mes?: MesISO;
}

/** A variable expense envelope ("sobre") with its monthly cap. */
export interface SobreInput {
  id: string;
  nombre: string;
  tope: Pesos;
}

/** A variable house expense. `sobreId` null means it has no envelope but still counts as variable. */
export interface GastoVariableInput {
  sobreId: string | null;
  fecha: DiaISO;
  monto: Pesos;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

/** A scheduled cuota of an active credit. */
export interface CuotaProgramadaInput {
  creditoId: string;
  fechaProgramada: DiaISO;
  /** Remaining amount due (valor programado − lo ya pagado). 0 means fully paid. */
  pendiente: Pesos;
}

/** A credit payment actually received (cash), grouped later by day. */
export interface CobroHechoInput {
  creditoId: string;
  fecha: DiaISO;
  monto: Pesos;
}

/** A "retiro a la casa" movement. */
export interface RetiroInput {
  id: string;
  fecha: DiaISO;
  monto: Pesos;
  cuentaOrigen: string;
  cuentaDestino: string;
}

// ---------------------------------------------------------------------------
// Resumen multi-mes
// ---------------------------------------------------------------------------

/** Business month for the "Ganancia y retiros" series. */
export interface MesNegocioInput {
  mes: MesISO;
  negocio: Pick<NegocioMesInput, "interesesCobrados" | "gastos" | "perdidos" | "retirosCasa">;
}

/** Collections of a past month against what was scheduled for it. */
export interface MesCobrosInput {
  mes: MesISO;
  /** Capital/interest actually received in the month. */
  cobradoCapital: Pesos;
  cobradoInteres: Pesos;
  /** Capital/interest of every cuota scheduled in the month ("lo que tocaba cobrar"). */
  esperadoCapital: Pesos;
  esperadoInteres: Pesos;
}

/** An unpaid cuota used for the forward projection. */
export interface CuotaPendienteInput {
  fechaProgramada: DiaISO;
  capital: Pesos;
  interes: Pesos;
}

/** One active credit for the delinquency buckets and the "sin pagos" warning. */
export interface CreditoCarteraInput {
  creditoId: string;
  saldoCapital: Pesos;
  /** Scheduled date of the oldest unpaid cuota, or null when nothing is overdue. */
  cuotaVencidaMasAntigua: DiaISO | null;
  /** Last day a payment was received, or null if never. */
  ultimoPago: DiaISO | null;
  /** First scheduled cuota date: the "sin pagos" clock starts here when nothing was ever paid. */
  primeraCuota: DiaISO | null;
}

// ---------------------------------------------------------------------------
// Arqueo
// ---------------------------------------------------------------------------

export interface ArqueoCuentaInput {
  cuentaId: string;
  nombre: string;
  ambito: Ambito;
  /** "Lopest dice". */
  saldoSistema: Pesos;
  /** "Contaste"; null while the field is empty. */
  contado: Pesos | null;
}

/** Counting history of an account, for warnings 4 and 5. */
export interface CuentaConteoInput {
  cuentaId: string;
  nombre: string;
  /** Day the counting clock starts when the account was never counted (its saldo inicial date). */
  desde: DiaISO;
  /** Latest saved arqueo, if any. `diferencia` = contado − sistema. */
  ultimoArqueo: { fecha: DiaISO; diferencia: Pesos } | null;
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

/** A movement about to be saved that takes money out of an account (warning 7). */
export interface SalidaPropuestaInput {
  cuentaId: string;
  nombreCuenta: string;
  saldoActual: Pesos;
  monto: Pesos;
}

/** State of a month already closed, for warning 10. */
export interface CierreMesInput {
  mes: MesISO;
  /** Casa "al cierre" once the month ended (what was left over). */
  sobrante: Pesos;
  /** Deposits to the ahorro account attributed to this cierre. */
  pasadoAlAhorro: Pesos;
}
