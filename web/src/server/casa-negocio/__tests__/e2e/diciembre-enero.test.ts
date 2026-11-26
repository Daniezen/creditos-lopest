/**
 * End-to-end calculation story of Casa y Negocio: December 2026 (the module
 * starts on the 1st with opening balances) and January 2027, read through the
 * world fixture (`mundo.fixture.ts`) and every tab's view model.
 *
 * Every expected figure below is written out BY HAND from the story in
 * `mundoBase()`, never computed with the code under test, so the test checks
 * the arithmetic of spec §3 and not only that the tabs agree with each other.
 *
 * Moments looked at:
 *   D21 = 2026-12-21 noon: mid-December, services overdue since the 20th.
 *   E01 = 2027-01-01 10:00: December closed, its leftover not yet saved.
 *   E20 = 2027-01-20 noon: January, December's cierre already passed.
 */
import { describe, expect, it } from "vitest";

import { evaluarMes } from "../../vista-mes";
import { construirTablero } from "../../vista-tablero";
import { construirVistaCasa } from "../../vista-casa";
import { construirVistaNegocio } from "../../vista-negocio";
import { construirVistaResumen } from "../../vista-resumen";
import { construirVistaAhorro } from "../../vista-ahorro";
import { construirVistaArqueo } from "../../vista-arqueo";

import { cierresDe, leerMes, leerResumen, local, mundoBase } from "./mundo.fixture";

const D21 = local("2026-12-21", "12:00");
const E01 = local("2027-01-01", "10:00");
const E20 = local("2027-01-20", "12:00");

/** The Tablero's two equations as label → amount. */
function ecuaciones(datos: ReturnType<typeof leerMes>) {
  const t = construirTablero(datos, evaluarMes(datos));
  if (t.estado !== "listo") throw new Error("Tablero sin cuentas");
  const tabla = (i: number) => Object.fromEntries(t.data.equations[i].terms.map((x) => [x.label, x.amount]));
  return { negocio: tabla(0), casa: tabla(1), data: t.data };
}

describe("Diciembre 2026 a mitad de mes (21-dic)", () => {
  const datos = leerMes(mundoBase(), "2026-12", D21);
  const { calculo } = evaluarMes(datos);

  it("Negocio: intereses cobrados − gastos − perdidos = ganancia; − retiros = reinvertido", () => {
    // Interest of cuota A2 (300.000); the abono of C is all capital.
    // Gastos: Papelería 80.000 (the voided 50.000 does not count). Perdidos: D, 1.500.000 on the 20th.
    expect(calculo.negocio).toEqual({
      intereses: 300_000,
      gastos: 80_000,
      perdidos: 1_500_000,
      ganancia: -1_280_000,
      retirosCasa: 3_000_000,
      reinvertido: -4_280_000,
    });
  });

  it("Casa: entró − fijos − variables = hoy; hoy − fijos sin pagar = al cierre", () => {
    // Entró: retiros 1.200.000 + 1.800.000 + ingreso 400.000. Fijos: arriendo. Variables: mercado + gasolina.
    // Sin pagar: servicios (300.000, venció el 20). SOAT is January's, predial June's.
    expect(calculo.casa).toMatchObject({
      entro: 3_400_000,
      fijos: 1_500_000,
      variables: 1_180_000,
      hoy: 720_000,
      fijosSinPagar: 300_000,
      alCierre: 420_000,
      quedaEnSobres: 1_120_000,
      siSeGastanSobres: -700_000,
    });
    expect(calculo.fijos.map((f) => [f.id, f.estado])).toEqual([
      ["arriendo", "PAGADO"],
      ["servicios", "SIN_PAGAR"],
      ["soat", "NO_TOCA"],
      ["predial", "NO_TOCA"],
    ]);
  });

  it("Tablero, Casa y Negocio muestran las mismas ecuaciones", () => {
    const { negocio, casa } = ecuaciones(datos);
    const vc = construirVistaCasa(datos).ecuacion;
    const vn = construirVistaNegocio(datos).ecuacion;
    expect(negocio).toEqual({ Intereses: 300_000, Gastos: 80_000, Perdidos: 1_500_000, Ganancia: -1_280_000, "A la casa": 3_000_000, Reinvertido: -4_280_000 });
    expect(vn).toEqual({ intereses: 300_000, gastos: 80_000, perdidos: 1_500_000, ganancia: -1_280_000, aCasa: 3_000_000, reinvertido: -4_280_000 });
    expect(casa).toEqual({ Entró: 3_400_000, Fijos: 1_500_000, Variables: 1_180_000, Hoy: 720_000, "Fijos sin pagar": 300_000, "Al cierre": 420_000 });
    expect(vc).toEqual({ entro: 3_400_000, fijos: 1_500_000, variables: 1_180_000, hoy: 720_000 });
  });

  it("el cierre que propone Ahorro es el «al cierre» de la casa", () => {
    const ahorro = construirVistaAhorro(datos, cierresDe(mundoBase(), D21));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.cierre).toMatchObject({ sobrante: 420_000, propuesto: 420_000, estado: "PENDIENTE", hecho: null });
    // The month line's cierre mark proposes the same figure.
    expect(calculo.agenda.eventos.find((e) => e.tipo === "CIERRE")?.monto).toBe(420_000);
  });

  it("los cobros de diciembre tienen cuenta; el desembolso de E queda «¿De dónde salió?»", () => {
    expect(datos.cobros.map((c) => [c.eventoFinancieroId, c.cuentaId, c.capital, c.interes])).toEqual([
      ["c-abono", "banco", 1_000_000, 0],
      ["a2", "banco", 1_000_000, 300_000],
    ]);
    expect(datos.sinCuenta.cobros).toEqual([]);
    expect(datos.sinCuenta.desembolsos.map((d) => d.creditoId)).toEqual(["cr-e"]);
    const negocio = construirVistaNegocio(datos);
    expect(negocio.sinCuenta.map((p) => [p.key, p.signo * p.monto])).toEqual([["desembolso:cr-e", -1_000_000]]);
    // Its book row asks the question and carries no running balance.
    const fila = negocio.libro.find((f) => f.key === "desembolso:cr-e")!;
    expect(fila).toMatchObject({ cuentaTexto: "Sin cuenta", saldo: null });
    expect(fila.asignacion?.pregunta).toBe("¿De dónde salió?");
  });
});

describe("Diciembre 2026 cerrado (1-ene, antes de pasar al ahorro)", () => {
  const mundo = mundoBase();
  const datos = leerMes(mundo, "2026-12", E01);
  const { calculo } = evaluarMes(datos);

  it("la cuota pagada el 31 a las 23:59 de Bogotá es de diciembre y queda «sin cuenta»", () => {
    expect(datos.cobros.map((c) => c.eventoFinancieroId)).toEqual(["c-abono", "a2", "c1"]);
    expect(datos.cobros.at(-1)).toMatchObject({ fechaPago: "2026-12-31", capital: 400_000, interes: 200_000, cuentaId: null, asignable: true });
    expect(datos.sinCuenta.cobros.map((c) => c.eventoFinancieroId)).toEqual(["c1"]);
  });

  it("cuentas del mes finales", () => {
    expect(calculo.negocio).toEqual({
      intereses: 500_000,
      gastos: 80_000,
      perdidos: 1_500_000,
      ganancia: -1_080_000,
      retirosCasa: 3_000_000,
      reinvertido: -4_080_000,
    });
    expect(calculo.casa).toMatchObject({ entro: 3_400_000, fijos: 1_800_000, variables: 1_180_000, hoy: 420_000, fijosSinPagar: 0, alCierre: 420_000 });
  });

  it("saldo de cada cuenta = inicial + movimientos + cobros asignados − desembolsos asignados", () => {
    const saldo = Object.fromEntries(datos.cuentas.map((c) => [c.id, c.saldoFinMes]));
    expect(saldo).toEqual({
      // 4.000.000 − papelería 80.000 + traslado 500.000 − préstamo B 3.000.000
      efectivo: 1_420_000,
      // 10.000.000 − retiros 3.000.000 − traslado 500.000 + cuota A2 1.300.000 + abono C 1.000.000
      banco: 8_800_000,
      // 500.000 + aporte 1.000.000 (the voided gasto never left)
      nequi: 1_500_000,
      // 800.000 + retiros 3.000.000 + ingreso 400.000 − arriendo − servicios − mercado − gasolina
      casa: 1_220_000,
      nu: 5_000_000,
    });
    const efectivo = datos.cuentas.find((c) => c.id === "efectivo")!;
    expect(efectivo).toMatchObject({ saldoInicioMes: 4_000_000, entradasMes: 500_000, salidasMes: 3_080_000 });
  });

  it("dinero de la familia = suma de cuentas; la cartera va aparte", () => {
    const { data } = ecuaciones(datos);
    expect(data.money.total).toBe(17_940_000);
    expect(data.money.accounts.reduce((s, a) => s + a.balance, 0)).toBe(17_940_000);
    // A 4.000.000 + B 3.000.000 + C 2.600.000 + E 1.000.000; D is written off.
    expect(data.street).toMatchObject({ amount: 10_600_000, activeCredits: 4 });
  });

  it("por dónde pasó la plata: los tres pasos suman", () => {
    const { data } = ecuaciones(datos);
    // Entró 500.000 + 2.400.000 + aportes 1.000.000 = 3.900.000; salió 4.000.000 + 80.000 + 3.000.000 = 7.080.000.
    expect(data.moneyPath.entered).toEqual({ interest: 500_000, capitalReturned: 2_400_000, contributions: 1_000_000, fromBefore: 3_180_000 });
    expect(data.moneyPath.left).toEqual({ newLoans: 4_000_000, expenses: 80_000, toHouse: 3_000_000, remained: 0 });
    expect(data.moneyPath.house).toEqual({ fixed: 1_800_000, variable: 1_180_000, surplus: 420_000 });
  });

  it("Ahorro propone pasar 420.000 y avisa (regla 10) igual que el Tablero", () => {
    const ahorro = construirVistaAhorro(datos, cierresDe(mundo, E01));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.cierre).toMatchObject({ sobrante: 420_000, propuesto: 420_000, estado: "PENDIENTE", origenId: "casa" });
    expect(ahorro.avisos.map((a) => a.elemento)).toEqual(["cierre:2026-12"]);

    // The Tablero raises it from January (the month after the close).
    const enero = leerMes(mundo, "2027-01", E01);
    const aviso = evaluarMes(enero).avisos.find((a) => a.reglaId === "CIERRE_SIN_AHORRO");
    expect(aviso?.montos).toEqual({ sobrante: 420_000, pasadoAlAhorro: 0, falta: 420_000 });
  });
});

describe("Enero 2027 (20-ene)", () => {
  const mundo = mundoBase();
  const datos = leerMes(mundo, "2027-01", E20);
  const { calculo, avisos } = evaluarMes(datos);

  it("cuentas del mes de enero", () => {
    expect(calculo.negocio).toEqual({ intereses: 150_000, gastos: 30_000, perdidos: 0, ganancia: 120_000, retirosCasa: 100_000, reinvertido: 20_000 });
    // Servicios is due today (on time); SOAT on the 25th: both still owed.
    expect(calculo.casa).toMatchObject({ entro: 2_100_000, fijos: 1_500_000, variables: 0, hoy: 600_000, fijosSinPagar: 1_200_000, alCierre: -600_000 });
  });

  it("saldos de enero arrancan donde terminó diciembre", () => {
    const c = Object.fromEntries(datos.cuentas.map((x) => [x.id, [x.saldoInicioMes, x.saldoFinMes]]));
    expect(c).toEqual({
      efectivo: [1_420_000, 1_420_000],
      banco: [8_800_000, 8_670_000],
      nequi: [1_500_000, 2_150_000],
      casa: [1_220_000, 1_400_000],
      nu: [5_000_000, 5_420_000],
    });
    expect(ecuaciones(datos).data.money.total).toBe(19_060_000);
  });

  it("«Pasar al ahorro» de diciembre queda hecho y la regla 10 calla en todas partes", () => {
    const dic = leerMes(mundo, "2026-12", E20);
    const ahorro = construirVistaAhorro(dic, cierresDe(mundo, E20));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(ahorro.cierre).toMatchObject({ estado: "HECHO", hecho: { monto: 420_000, fecha: "2027-01-02" } });
    expect(ahorro.avisos).toEqual([]);
    expect(avisos.some((a) => a.reglaId === "CIERRE_SIN_AHORRO")).toBe(false);
    // The bar of December counts the cierre for the month it closed, not the day it was made.
    expect(ahorro.barras.find((b) => b.mes === "2026-12")?.valor).toBe(420_000);
    const eneroAhorro = construirVistaAhorro(datos, cierresDe(mundo, E20));
    if (eneroAhorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    expect(eneroAhorro.barras.find((b) => b.mes === "2026-12")?.valor).toBe(420_000);
    // January's own cierre (−600.000 al cierre) has nothing to propose.
    expect(eneroAhorro.cierre).toMatchObject({ sobrante: -600_000, propuesto: 0, estado: "NADA" });
  });

  it("Resumen: la tarjeta de cada mes coincide con Tablero, Negocio, Casa y Ahorro", () => {
    const resumen = construirVistaResumen(leerResumen(mundo, E20));
    const tarjeta = (mes: string) => resumen.tarjetas.find((t) => t.mes === mes)!;

    for (const [mes, ahora] of [["2026-12", E20], ["2027-01", E20]] as const) {
      const d = leerMes(mundo, mes, ahora);
      const { negocio, casa } = ecuaciones(d);
      const t = tarjeta(mes);
      expect(t.ganancia).toBe(negocio.Ganancia);
      expect(t.retiros).toBe(negocio["A la casa"]);
      expect(t.reinvertido).toBe(negocio.Reinvertido);
      expect(t.casaSobro).toBe(casa.Hoy);
      expect(t.ahorro).toBe(d.cuentas.find((c) => c.id === "nu")!.saldoFinMes);
    }
    // December closed with every fijo paid: «sobró» equals the cierre Ahorro passed.
    expect(tarjeta("2026-12")).toMatchObject({ ganancia: -1_080_000, retiros: 3_000_000, reinvertido: -4_080_000, casaSobro: 420_000, ahorro: 5_000_000 });
    // November predates the module: real interest, no recorded withdrawals.
    expect(tarjeta("2026-11")).toMatchObject({ ganancia: 300_000, retiros: null, reinvertido: null, casaSobro: null });
    // Retiros > ganancia only in December.
    expect(resumen.ganancia.mesesCapitalBajo).toEqual(["2026-12"]);
    expect(resumen.ganancia.capitalPerdido).toBe(4_080_000);
  });

  /**
   * KNOWN GAP, for the Resumen owner (vista-resumen.ts is not ours to edit):
   * the month card's «casaSobro» is Casa «hoy» (entró − fijos − variables),
   * while Ahorro's cierre and rule 10 use «al cierre» (− fijos sin pagar,
   * spec §3). They agree whenever every fijo was paid (the story above), and
   * differ when December closes with services unpaid: 720.000 vs 420.000.
   * Either the card shows «al cierre» for closed months, or its label must
   * say it is «hoy». Flip to `it` once decided and fixed.
   */
  it.fails("Resumen y Ahorro dicen lo mismo de un mes cerrado con un fijo sin pagar", () => {
    const m = mundoBase();
    m.movimientos = m.movimientos.filter((x) => x.id !== "d-servicios" && x.id !== "e-cierre-dic");
    const ahorro = construirVistaAhorro(leerMes(m, "2026-12", E20), cierresDe(m, E20));
    if (ahorro.estado !== "LISTO") throw new Error("sin cuenta de ahorro");
    const tarjeta = construirVistaResumen(leerResumen(m, E20)).tarjetas.find((t) => t.mes === "2026-12")!;
    expect(ahorro.cierre.sobrante).toBe(420_000);
    expect(tarjeta.casaSobro).toBe(ahorro.cierre.sobrante);
  });

  it("Resumen: «en la calle» y los tramos son los del Tablero", () => {
    const resumen = construirVistaResumen(leerResumen(mundo, E20));
    expect(resumen.cartera.enLaCalle).toBe(ecuaciones(datos).data.street.amount);
    // A 4.000.000 + B 2.500.000 + C 2.600.000 + E 1.000.000.
    expect(resumen.cartera.enLaCalle).toBe(10_100_000);
  });

  it("Arqueo: «Lopest dice» es el saldo actual y la diferencia es contado − sistema", () => {
    const arqueo = construirVistaArqueo(datos);
    const sistema = Object.fromEntries(arqueo.grupos.flatMap((g) => g.cuentas.map((c) => [c.cuentaId, c.saldoSistema])));
    expect(sistema).toEqual(Object.fromEntries(datos.cuentas.map((c) => [c.id, c.saldoActual])));
    expect(arqueo.historial[0]).toMatchObject({ texto: "21 dic · Efectivo −$ 20.000", tono: "problema" });
  });

  it("los cobros anteriores al arranque quedan «sin cuenta» para siempre y fuera de los saldos", () => {
    const nov = leerMes(mundo, "2026-11", E20);
    expect(nov.cobros.map((c) => [c.eventoFinancieroId, c.asignable, c.cuentaId])).toEqual([["a1", false, null]]);
    expect(datos.sinCuenta.cobros.map((c) => c.eventoFinancieroId)).toEqual(["c1"]);
    expect(nov.historial.at(-1)).toMatchObject({ mes: "2026-11", interesCobrado: 300_000, capitalCobrado: 1_000_000 });
  });
});
