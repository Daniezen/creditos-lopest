import type { Ambito, ArqueoCuentaInput, Pesos } from "./inputs";
import { assertPesos } from "./money";
import { pesos } from "./texto";

/**
 * Arqueo (Arqueo.dc.html): per account, "Lopest dice" against "contaste".
 * diferencia = contado − sistema, so a negative difference means money is missing.
 */

export type ResultadoArqueo = "CUADRA" | "FALTA" | "SOBRA" | "POR_CONTAR";

export interface ArqueoCuenta {
  cuentaId: string;
  nombre: string;
  ambito: Ambito;
  saldoSistema: Pesos;
  contado: Pesos | null;
  /** contado − sistema; null while not counted. */
  diferencia: Pesos | null;
  resultado: ResultadoArqueo;
  /** "Cuadra" · "Faltan $ 50.000" · "Sobran $ 20.000" · "Por contar". */
  texto: string;
}

export interface ArqueoGlobal {
  cuentas: ArqueoCuenta[];
  total: number;
  contadas: number;
  cuadran: number;
  /** Every account counted and every one balanced. */
  todoCuadra: boolean;
  /** "3 de 5 cuadran" (singular "1 de 5 cuadra"). */
  texto: string;
}

export function arquearCuenta(c: ArqueoCuentaInput): ArqueoCuenta {
  const saldoSistema = assertPesos(c.saldoSistema, `saldo de ${c.nombre}`);
  const base = { cuentaId: c.cuentaId, nombre: c.nombre, ambito: c.ambito, saldoSistema, contado: c.contado };
  if (c.contado === null) return { ...base, diferencia: null, resultado: "POR_CONTAR", texto: "Por contar" };
  const diferencia = assertPesos(c.contado, `contado de ${c.nombre}`) - saldoSistema;
  if (diferencia === 0) return { ...base, diferencia, resultado: "CUADRA", texto: "Cuadra" };
  return diferencia < 0
    ? { ...base, diferencia, resultado: "FALTA", texto: `Faltan ${pesos(-diferencia)}` }
    : { ...base, diferencia, resultado: "SOBRA", texto: `Sobran ${pesos(diferencia)}` };
}

export function arquear(cuentas: readonly ArqueoCuentaInput[]): ArqueoGlobal {
  const r = cuentas.map(arquearCuenta);
  const cuadran = r.filter((c) => c.resultado === "CUADRA").length;
  const contadas = r.filter((c) => c.resultado !== "POR_CONTAR").length;
  return {
    cuentas: r, total: r.length, contadas, cuadran,
    todoCuadra: r.length > 0 && cuadran === r.length,
    texto: `${cuadran} de ${r.length} ${cuadran === 1 ? "cuadra" : "cuadran"}`,
  };
}
