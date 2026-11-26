/**
 * Months are always recomputed, never frozen (spec §3), and every figure is
 * an integer peso bucketed by Bogota calendar day (UTC-5, the month ends at
 * 23:59:59 local, which is 04:59:59Z of the next day).
 */
import { describe, expect, it } from "vitest";

import { fechaClave, mesClave, rangoMes } from "@/features/casa-negocio/mes";

import { evaluarMes } from "../../vista-mes";
import { construirVistaNegocio } from "../../vista-negocio";
import { construirVistaResumen } from "../../vista-resumen";

import { leerMes, leerResumen, local, mundoBase, type Mundo } from "./mundo.fixture";

const E20 = local("2027-01-20", "12:00");
const negocio = (m: Mundo, mes: string) => evaluarMes(leerMes(m, mes, E20)).calculo.negocio;
const saldos = (m: Mundo, mes: string) => Object.fromEntries(leerMes(m, mes, E20).cuentas.map((c) => [c.id, c.saldoFinMes]));

describe("siempre recalculado", () => {
  it("editar en enero un gasto de diciembre cambia diciembre y arrastra los saldos de enero", () => {
    const m = mundoBase();
    m.movimientos.find((x) => x.id === "d-gasto-neg")!.monto = 180_000;
    expect(negocio(m, "2026-12")).toMatchObject({ gastos: 180_000, ganancia: -1_180_000, reinvertido: -4_180_000 });
    expect(saldos(m, "2026-12").efectivo).toBe(1_320_000);
    expect(leerMes(m, "2027-01", E20).cuentas.find((c) => c.id === "efectivo")!.saldoInicioMes).toBe(1_320_000);
    // January's own result does not move.
    expect(negocio(m, "2027-01").ganancia).toBe(120_000);
    // Resumen recomputes the same month.
    expect(construirVistaResumen(leerResumen(m, E20)).tarjetas.find((t) => t.mes === "2026-12")!.ganancia).toBe(-1_180_000);
  });

  it("anular un retiro de diciembre lo saca de Negocio, de Casa y de los saldos", () => {
    const m = mundoBase();
    m.movimientos.find((x) => x.id === "d-retiro-2")!.anulado = true;
    const dic = evaluarMes(leerMes(m, "2026-12", E20)).calculo;
    expect(dic.negocio).toMatchObject({ retirosCasa: 1_200_000, reinvertido: -2_280_000 });
    expect(dic.casa).toMatchObject({ entro: 1_600_000, hoy: -1_380_000 });
    expect(saldos(m, "2026-12")).toMatchObject({ banco: 10_600_000, casa: -580_000 });
  });

  it("revertir el castigo devuelve la ganancia y pone el crédito otra vez en la calle", () => {
    const m = mundoBase();
    m.castigos[0].revertido = true;
    expect(negocio(m, "2026-12")).toMatchObject({ perdidos: 0, ganancia: 420_000, reinvertido: -2_580_000 });
    const enero = leerMes(m, "2027-01", E20);
    expect(enero.cartera).toMatchObject({ enLaCalle: 12_100_000, creditosActivos: 5 });
    expect(enero.cuotasPorCobrar.some((c) => c.creditoId === "cr-d")).toBe(true);
    expect(construirVistaResumen(leerResumen(m, E20)).tarjetas.find((t) => t.mes === "2026-12")!.ganancia).toBe(420_000);
  });

  it("asignar cuenta a un cobro o desembolso de diciembre mueve los saldos de diciembre", () => {
    const m = mundoBase();
    m.eventos.find((e) => e.id === "c1")!.cuentaId = "banco";
    m.creditos.find((c) => c.id === "cr-e")!.cuentaId = "nequi";
    expect(saldos(m, "2026-12")).toMatchObject({ banco: 9_400_000, nequi: 500_000 });
    const dic = leerMes(m, "2026-12", E20);
    expect(dic.sinCuenta).toEqual({ cobros: [], desembolsos: [] });
    // The business result does not depend on accounts: cash basis by date.
    expect(negocio(m, "2026-12").ganancia).toBe(-1_080_000);
    // The book's running balance ends at the accounts' month-end balance.
    const libro = construirVistaNegocio(dic).libro;
    expect(libro[0].saldo).toBe(1_420_000 + 9_400_000 + 500_000);
  });
});

describe("fechas de Bogotá y pesos enteros", () => {
  it("el mes va de las 00:00 del 1 a las 23:59:59 del último día, hora de Bogotá", () => {
    const { inicio, fin } = rangoMes("2026-12");
    expect(inicio.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(fin.toISOString()).toBe("2027-01-01T05:00:00.000Z");
    expect(mesClave(local("2026-12-31", "23:59"))).toBe("2026-12");
    expect(mesClave(local("2027-01-01", "00:00"))).toBe("2027-01");
    expect(fechaClave(new Date("2027-01-01T04:59:59.999Z"))).toBe("2026-12-31");
  });

  it("la cuota pagada a medianoche del 1-ene ya es de enero", () => {
    const m = mundoBase();
    const c1 = m.eventos.find((e) => e.id === "c1")!;
    c1.pago = { ...c1.pago!, en: local("2027-01-01", "00:00") };
    expect(negocio(m, "2026-12").intereses).toBe(300_000);
    expect(negocio(m, "2027-01").intereses).toBe(350_000);
    const resumen = construirVistaResumen(leerResumen(m, E20));
    expect(resumen.tarjetas.find((t) => t.mes === "2027-01")!.ganancia).toBe(320_000);
  });

  it("todo lo que muestran las pestañas es un peso entero", () => {
    for (const mes of ["2026-12", "2027-01"]) {
      const { calculo } = evaluarMes(leerMes(mundoBase(), mes, E20));
      const cifras = [...Object.values(calculo.negocio), ...Object.values(calculo.casa)];
      for (const cifra of cifras) expect(Number.isSafeInteger(cifra)).toBe(true);
    }
  });
});
