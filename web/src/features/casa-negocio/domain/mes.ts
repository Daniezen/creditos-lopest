import { construirAgenda, type AgendaMes } from "./agenda";
import { calcularCuentasCasa, calcularCuentasNegocio, type CuentasCasa, type CuentasNegocio } from "./cuentas-mes";
import {
  calcularFijosDelMes,
  calcularSobresDelMes,
  fijosSinPagar,
  gastadoEnFijos,
  type FijoDelMes,
  type SobresDelMes,
} from "./fijos-sobres";
import { calcularFlujo, type FlujoMes } from "./flujo";
import type {
  CasaIngresosInput,
  CobroHechoInput,
  CuotaProgramadaInput,
  DiaISO,
  GastoFijoInput,
  GastoVariableInput,
  MesISO,
  NegocioMesInput,
  PagoFijoInput,
  RetiroInput,
  SobreInput,
} from "./inputs";

/**
 * One-call composition of everything a month view needs (Tablero, Casa, Negocio header and
 * the month line). The pieces stay individually exported; this only wires outputs into the
 * next step's inputs in the one correct order (fijos/sobres → casa → flujo/agenda), so the
 * data layer cannot accidentally feed, say, a fijos total that disagrees with the fijo list.
 */
export interface MesInput {
  mes: MesISO;
  hoy: DiaISO;
  negocio: NegocioMesInput;
  casaIngresos: CasaIngresosInput;
  gastosFijos: readonly GastoFijoInput[];
  pagosFijos: readonly PagoFijoInput[];
  sobres: readonly SobreInput[];
  gastosVariables: readonly GastoVariableInput[];
  cobrosHechos: readonly CobroHechoInput[];
  cuotas: readonly CuotaProgramadaInput[];
  retiros: readonly RetiroInput[];
  /** Rule 2 threshold, so envelope levels and avisos agree. Default 90. */
  umbralSobre?: number;
}

export interface MesCalculado {
  negocio: CuentasNegocio;
  casa: CuentasCasa;
  fijos: FijoDelMes[];
  sobres: SobresDelMes;
  flujo: FlujoMes;
  agenda: AgendaMes;
}

export function calcularMes(i: MesInput): MesCalculado {
  const negocio = calcularCuentasNegocio(i.negocio);
  const fijos = calcularFijosDelMes(i.gastosFijos, i.pagosFijos, i.mes, i.hoy);
  const sobres = calcularSobresDelMes(i.sobres, i.gastosVariables, i.mes, i.umbralSobre);
  const casa = calcularCuentasCasa({
    ingresos: i.casaIngresos,
    fijos: gastadoEnFijos(i.pagosFijos, i.mes),
    variables: sobres.gastadoTotal,
    fijosSinPagar: fijosSinPagar(fijos),
    quedaEnSobres: sobres.quedaTotal,
  });
  return {
    negocio, casa, fijos, sobres,
    flujo: calcularFlujo(i.negocio, casa),
    agenda: construirAgenda({ mes: i.mes, hoy: i.hoy, cobrosHechos: i.cobrosHechos, cuotas: i.cuotas, fijos, retiros: i.retiros, alCierre: casa.alCierre }),
  };
}
