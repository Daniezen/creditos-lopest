import type { CuentasCasa } from "./cuentas-mes";
import type { NegocioMesInput, Pesos } from "./inputs";
import { assertPesos } from "./money";

/**
 * "Por dónde pasó la plata" (Main.dc.html): three stacked bars that must add up.
 *
 *   1. Entró al negocio  = intereses + capital que devolvieron (+ aportes, + lo que había)
 *   2. Salió del negocio = préstamos nuevos + gastos + a la casa + quedó en las cuentas
 *   3. Se usó en la casa = fijos + variables + sobra   (sits under the "A la casa" segment)
 *
 * Steps 1 and 2 always share the same total. When the month paid out more than it took in,
 * "Quedó en las cuentas" would be negative, which a bar cannot draw: instead step 1 gains a
 * "De lo que había" part (money taken from earlier balances) and step 2 drops the leftover.
 * Step 3 mirrors that: if the house spent more than it received there is no "Sobra"; the
 * step total becomes what was used and the uncovered amount is reported in `faltoEnCasa`
 * (no part is ever negative, and parts always add up to their step total).
 */

export type ParteFlujoId =
  | "intereses" | "capital" | "aportes" | "deLoQueHabia"
  | "prestamosNuevos" | "gastos" | "aLaCasa" | "quedoEnCuentas"
  | "fijos" | "variables" | "sobra";

export interface ParteFlujo {
  id: ParteFlujoId;
  label: string;
  monto: Pesos;
}

export interface PasoFlujo {
  n: 1 | 2 | 3;
  titulo: string;
  total: Pesos;
  /** Only parts with a positive amount; UI widths are `monto / paso1.total`. */
  partes: ParteFlujo[];
}

export interface FlujoMes {
  pasos: [PasoFlujo, PasoFlujo, PasoFlujo];
  /** Step 2 note in the canvas: "Incluye gastos por $ 0,2 M". */
  gastosNegocio: Pesos;
  /** House spending not covered by what came in this month (0 when it was covered). */
  faltoEnCasa: Pesos;
}

const parte = (id: ParteFlujoId, label: string, monto: Pesos): ParteFlujo => ({ id, label, monto });
const positivas = (partes: ParteFlujo[]) => partes.filter((p) => p.monto > 0);

export function calcularFlujo(
  negocio: Pick<NegocioMesInput, "interesesCobrados" | "capitalCobrado" | "aportes" | "desembolsos" | "gastos" | "retirosCasa">,
  casa: Pick<CuentasCasa, "entro" | "fijos" | "variables">,
): FlujoMes {
  const intereses = assertPesos(negocio.interesesCobrados, "interesesCobrados");
  const capital = assertPesos(negocio.capitalCobrado, "capitalCobrado");
  const aportes = assertPesos(negocio.aportes, "aportes");
  const desembolsos = assertPesos(negocio.desembolsos, "desembolsos");
  const gastos = assertPesos(negocio.gastos, "gastos");
  const retiros = assertPesos(negocio.retirosCasa, "retirosCasa");

  const entro = intereses + capital + aportes;
  const salio = desembolsos + gastos + retiros;
  const quedo = entro - salio;
  const deLoQueHabia = Math.max(0, -quedo);
  const total = entro + deLoQueHabia;

  const paso1: PasoFlujo = {
    n: 1, titulo: "Entró al negocio", total,
    partes: positivas([parte("intereses", "Intereses", intereses), parte("capital", "Capital que devolvieron", capital), parte("aportes", "Aportes", aportes), parte("deLoQueHabia", "De lo que había", deLoQueHabia)]),
  };
  const paso2: PasoFlujo = {
    n: 2, titulo: "Salió del negocio", total,
    partes: positivas([parte("prestamosNuevos", "Préstamos nuevos", desembolsos), parte("gastos", "Gastos", gastos), parte("aLaCasa", "A la casa", retiros), parte("quedoEnCuentas", "Quedó en las cuentas", Math.max(0, quedo))]),
  };
  const usado = casa.fijos + casa.variables;
  const sobra = casa.entro - usado;
  const paso3: PasoFlujo = {
    n: 3, titulo: "Se usó en la casa", total: Math.max(casa.entro, usado),
    partes: positivas([parte("fijos", "Fijos", casa.fijos), parte("variables", "Variables", casa.variables), parte("sobra", "Sobra", Math.max(0, sobra))]),
  };
  return { pasos: [paso1, paso2, paso3], gastosNegocio: gastos, faltoEnCasa: Math.max(0, -sobra) };
}
