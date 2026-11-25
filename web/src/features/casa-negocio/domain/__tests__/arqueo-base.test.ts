import { describe, expect, it } from "vitest";

import { arquear } from "../arqueo";
import { diaBogota, diaEnMes, diasEnMes, diferenciaDias, partesDia, sumarMeses } from "../dates";
import { assertPesos, porcentajeEntero } from "../money";
import { millones, pesos } from "../texto";

describe("arqueo", () => {
  it("lienzo: 3 de 5 cuadran, Nequi faltan $ 50.000, Bancolombia por contar", () => {
    const a = arquear([
      { cuentaId: "efectivo", nombre: "Efectivo", ambito: "NEGOCIO", saldoSistema: 1_320_000, contado: 1_320_000 },
      { cuentaId: "banco", nombre: "Bancolombia", ambito: "NEGOCIO", saldoSistema: 11_900_000, contado: null },
      { cuentaId: "nequi", nombre: "Nequi", ambito: "NEGOCIO", saldoSistema: 1_600_000, contado: 1_550_000 },
      { cuentaId: "casa", nombre: "Cuenta casa", ambito: "CASA", saldoSistema: 833_000, contado: 833_000 },
      { cuentaId: "nu", nombre: "Nu · ahorro", ambito: "CASA", saldoSistema: 7_006_000, contado: 7_006_000 },
    ]);
    expect(a).toMatchObject({ total: 5, contadas: 4, cuadran: 3, todoCuadra: false, texto: "3 de 5 cuadran" });
    expect(a.cuentas.map((c) => [c.resultado, c.diferencia, c.texto])).toEqual([
      ["CUADRA", 0, "Cuadra"], ["POR_CONTAR", null, "Por contar"], ["FALTA", -50_000, "Faltan $ 50.000"], ["CUADRA", 0, "Cuadra"], ["CUADRA", 0, "Cuadra"],
    ]);
  });

  it("sobrante, singular y todo cuadra", () => {
    const una = arquear([{ cuentaId: "e", nombre: "Efectivo", ambito: "NEGOCIO", saldoSistema: 100, contado: 20_100 }]);
    expect(una.cuentas[0].texto).toBe("Sobran $ 20.000");
    expect(una.texto).toBe("0 de 1 cuadran");
    const ok = arquear([{ cuentaId: "e", nombre: "E", ambito: "NEGOCIO", saldoSistema: 0, contado: 0 }]);
    expect(ok).toMatchObject({ todoCuadra: true, texto: "1 de 1 cuadra" });
    expect(arquear([]).todoCuadra).toBe(false);
  });
});

describe("fechas", () => {
  it("días del mes, bisiestos y diferencia exacta", () => {
    expect(diasEnMes("2026-11")).toBe(30);
    expect(diasEnMes("2028-02")).toBe(29);
    expect(diaEnMes("2026-11", 31)).toBe("2026-11-30");
    expect(diferenciaDias("2026-11-16", "2026-11-25")).toBe(9);
    expect(diferenciaDias("2026-12-31", "2027-01-01")).toBe(1);
    expect(sumarMeses("2026-11", 2)).toBe("2027-01");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
  });

  it("rechaza días imposibles", () => {
    expect(() => partesDia("2026-02-30")).toThrow(RangeError);
    expect(() => partesDia("2026-11-5")).toThrow(RangeError);
  });

  it("resuelve instantes en America/Bogota (UTC−5)", () => {
    // 2026-12-01 03:00 UTC is still Nov 30 at 22:00 in Bogota.
    expect(diaBogota(new Date("2026-12-01T03:00:00Z"))).toBe("2026-11-30");
    expect(diaBogota(new Date("2026-12-01T05:00:00Z"))).toBe("2026-12-01");
  });
});

describe("dinero y texto", () => {
  it("enteros de pesos o error", () => {
    expect(assertPesos(5)).toBe(5);
    expect(() => assertPesos(0.1 + 0.2)).toThrow(RangeError);
    expect(() => assertPesos(Number.NaN)).toThrow(RangeError);
  });

  it("porcentaje piso y base cero", () => {
    expect(porcentajeEntero(899_999, 1_000_000)).toBe(89);
    expect(porcentajeEntero(1, 0)).toBeNull();
  });

  it("formato del lienzo, agrupando siempre", () => {
    expect(pesos(1_787_000)).toBe("$ 1.787.000");
    expect(pesos(5_000)).toBe("$ 5.000");
    expect(pesos(-1_499_000)).toBe("−$ 1.499.000");
    expect(pesos(0)).toBe("$ 0");
    expect(millones(3_000_000)).toBe("3,0 M");
    expect(millones(8_400_000)).toBe("8,4 M");
    expect(millones(186_400_000)).toBe("186,4 M");
    expect(millones(-2_049_999)).toBe("−2,0 M");
  });
});
