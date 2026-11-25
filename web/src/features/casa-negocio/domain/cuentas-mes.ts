import type {
  Ambito,
  CarteraInput,
  CasaIngresosInput,
  NegocioMesInput,
  Pesos,
  SaldoCuentaInput,
} from "./inputs";
import { assertPesos, sumarPesos } from "./money";

/**
 * "Las cuentas del mes" (spec §3). Always recomputed from the month's movements, never
 * frozen, so a late correction (a reassigned cobro, a reversed castigo) flows through.
 */

export interface CuentasNegocio {
  intereses: Pesos;
  gastos: Pesos;
  perdidos: Pesos;
  /** intereses − gastos − perdidos. */
  ganancia: Pesos;
  retirosCasa: Pesos;
  /** ganancia − retiros a la casa. Negative means the capital shrank this month. */
  reinvertido: Pesos;
}

/** Negocio: intereses cobrados − gastos − perdidos = ganancia; ganancia − retiros = reinvertido. */
export function calcularCuentasNegocio(
  n: Pick<NegocioMesInput, "interesesCobrados" | "gastos" | "perdidos" | "retirosCasa">,
): CuentasNegocio {
  const intereses = assertPesos(n.interesesCobrados, "interesesCobrados");
  const gastos = assertPesos(n.gastos, "gastos");
  const perdidos = assertPesos(n.perdidos, "perdidos");
  const retirosCasa = assertPesos(n.retirosCasa, "retirosCasa");
  const ganancia = intereses - gastos - perdidos;
  return { intereses, gastos, perdidos, ganancia, retirosCasa, reinvertido: ganancia - retirosCasa };
}

export interface CuentasCasa {
  /** retiros recibidos + ingresos extra. */
  entro: Pesos;
  /** Cash paid for fixed expenses in the month. */
  fijos: Pesos;
  /** Cash spent on variable expenses in the month. */
  variables: Pesos;
  /** entró − fijos − variables. */
  hoy: Pesos;
  /** Fixed expenses still owed this month (overdue + upcoming). */
  fijosSinPagar: Pesos;
  /** hoy − fijos sin pagar. */
  alCierre: Pesos;
  /** What remains in the envelopes, floored at 0 overall (see `siSeGastanSobres`). */
  quedaEnSobres: Pesos;
  /** alCierre − quedaEnSobres: where the month ends if every envelope is spent to its cap. */
  siSeGastanSobres: Pesos;
}

export interface CasaMesInput {
  ingresos: CasaIngresosInput;
  /** From `gastadoEnFijos`. */
  fijos: Pesos;
  /** From `SobresDelMes.gastadoTotal`. */
  variables: Pesos;
  /** From `fijosSinPagar`. */
  fijosSinPagar: Pesos;
  /**
   * From `SobresDelMes.quedaTotal`: caps total − spent in envelopes. The canvas uses this net
   * figure ("Quedan $ 2.130.000 de $ 4.070.000"), so an envelope already over its cap offsets
   * the slack of the others. A negative net (overspent as a whole) adds nothing more to spend.
   */
  quedaEnSobres: Pesos;
}

/** Casa: entró − fijos − variables = hoy; hoy − fijos sin pagar = al cierre; minus envelopes. */
export function calcularCuentasCasa(c: CasaMesInput): CuentasCasa {
  const entro = assertPesos(c.ingresos.retirosRecibidos, "retirosRecibidos") + assertPesos(c.ingresos.ingresosExtra, "ingresosExtra");
  const fijos = assertPesos(c.fijos, "fijos");
  const variables = assertPesos(c.variables, "variables");
  const fijosSinPagar = assertPesos(c.fijosSinPagar, "fijosSinPagar");
  const hoy = entro - fijos - variables;
  const alCierre = hoy - fijosSinPagar;
  const quedaEnSobres = Math.max(0, assertPesos(c.quedaEnSobres, "quedaEnSobres"));
  return { entro, fijos, variables, hoy, fijosSinPagar, alCierre, quedaEnSobres, siSeGastanSobres: alCierre - quedaEnSobres };
}

export interface CuentaFamilia extends SaldoCuentaInput {
  /** Share of the family total in basis points (0–10000), for proportional bars. 0 if total ≤ 0. */
  participacionBp: number;
}

export interface DineroFamilia {
  /** Sum of every account balance ("Dónde está la plata"). */
  total: Pesos;
  porAmbito: Record<Ambito, Pesos>;
  /** Accounts sorted by balance, largest first (the canvas bar order). */
  cuentas: CuentaFamilia[];
  /** Portfolio lent out. Deliberately NOT part of `total` (spec §3). */
  enLaCalle: CarteraInput;
}

/** Familia: sum of accounts; the portfolio ("en la calle") travels alongside, never summed in. */
export function calcularDineroFamilia(cuentas: readonly SaldoCuentaInput[], cartera: CarteraInput): DineroFamilia {
  const total = sumarPesos(cuentas.map((c) => c.saldo), "saldo");
  const porAmbito: Record<Ambito, Pesos> = { NEGOCIO: 0, CASA: 0 };
  for (const c of cuentas) porAmbito[c.ambito] += c.saldo;
  assertPesos(cartera.capitalPendiente, "capitalPendiente");
  return {
    total,
    porAmbito,
    cuentas: [...cuentas]
      .sort((a, b) => b.saldo - a.saldo)
      .map((c) => ({ ...c, participacionBp: total > 0 ? Math.round((Math.max(0, c.saldo) * 10_000) / total) : 0 })),
    enLaCalle: { ...cartera },
  };
}
