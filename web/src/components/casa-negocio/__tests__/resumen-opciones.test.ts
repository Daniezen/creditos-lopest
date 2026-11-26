/**
 * ECharts options of the Resumen charts, checked without a browser: where
 * HOY, the red months and the projected bars land, and that every color is a
 * theme role (the fake theme returns each token's own name as its value).
 */
import { describe, expect, it } from "vitest";

import { resolveChartTheme } from "@/design-system/themes/lopest-chart";
import type { CobrosVista, GananciaVista } from "@/server/casa-negocio/vista-resumen";

import { anioVisible, ejeCorto, millonesCorto, opcionCobros, opcionGanancia } from "../resumen/opciones";

const theme = resolveChartTheme((v) => (v.startsWith("--dataviz") ? v : "10px"), 16, "Geist");

type Serie = { id?: string; type?: string; data?: unknown[]; markArea?: { data?: unknown[] }; markLine?: { data?: unknown[] }; xAxisIndex?: number };
const series = (o: { series?: unknown }) => o.series as Serie[];
const serie = (o: { series?: unknown }, id: string) => series(o).find((s) => s.id === id)!;

const ganancia: GananciaVista = {
  meses: [
    { mes: "2026-09", ganancia: 4_200_000, retiros: null, reinvertido: null, capitalBajo: false, anotado: false },
    { mes: "2026-10", ganancia: 3_300_000, retiros: 5_000_000, reinvertido: -1_700_000, capitalBajo: true, anotado: true },
    { mes: "2026-11", ganancia: 6_060_000, retiros: 5_500_000, reinvertido: 560_000, capitalBajo: false, anotado: true },
  ],
  mesesCapitalBajo: ["2026-10"],
  capitalPerdido: 1_700_000,
  aviso: "x",
  lectura: "x",
};

const cobros: CobrosVista = {
  meses: [
    { mes: "2026-10", capital: 9_000_000, interes: 5_000_000, total: 14_000_000, esperado: 15_000_000, cumplimiento: 93, proyectado: false },
    { mes: "2026-11", capital: 9_500_000, interes: 5_500_000, total: 15_000_000, esperado: 14_000_000, cumplimiento: 107, proyectado: false },
    { mes: "2026-12", capital: 9_800_000, interes: 5_900_000, total: 15_700_000, esperado: null, cumplimiento: null, proyectado: true },
    { mes: "2027-01", capital: 9_400_000, interes: 5_600_000, total: 15_000_000, esperado: null, cumplimiento: null, proyectado: true },
  ],
  indiceHoy: 2,
  cobrado: 29_000_000,
  esperado: 29_000_000,
  cumplimiento: 100,
  viene: 30_700_000,
  vieneIntereses: 11_500_000,
  lectura: "x",
};

describe("opcionGanancia", () => {
  const o = opcionGanancia(ganancia, theme);

  it("sombrea solo los meses en que bajó el capital, banda completa", () => {
    expect(serie(o, "fondo:capital-bajo").markArea!.data).toEqual([[{ xAxis: 0.5 }, { xAxis: 1.5 }]]);
    expect(serie(o, "fondo:capital-bajo").xAxisIndex).toBe(1);
  });

  it("dibuja retiros en barras (0 cuando no se anotaba) y la ganancia en línea", () => {
    expect(serie(o, "m:retiros").data).toEqual([0, 5_000_000, 5_500_000]);
    expect(serie(o, "m:ganancia")).toMatchObject({ type: "line", data: [4_200_000, 3_300_000, 6_060_000] });
  });

  it("usa solo colores del tema", () => {
    expect(JSON.stringify(o)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(JSON.stringify(o)).toContain("--dataviz-cn-alert");
  });
});

describe("opcionCobros", () => {
  const o = opcionCobros(cobros, theme);

  it("pone HOY entre el último mes cobrado y el primero proyectado", () => {
    const fondo = serie(o, "fondo:futuro");
    expect(fondo.markLine!.data).toEqual([{ xAxis: 1.5 }]);
    expect(fondo.markArea!.data).toEqual([[{ xAxis: 1.5 }, { xAxis: 3.5 }]]);
  });

  it("apila capital e interés y aclara los meses por venir", () => {
    const capital = serie(o, "m:capital").data as { value: number; itemStyle: { color: string } }[];
    expect(capital.map((d) => d.value)).toEqual([9_000_000, 9_500_000, 9_800_000, 9_400_000]);
    expect(capital[0].itemStyle.color).toBe("--dataviz-cn-negocio-soft");
    expect(capital[2].itemStyle.color).toBe("--dataviz-cn-projected-capital");
  });

  it("marca lo que tocaba solo en meses pasados y etiqueta sobre el mayor de los dos", () => {
    expect(serie(o, "tocaba").data).toEqual([15_000_000, 14_000_000, null, null]);
    expect(serie(o, "etiquetas").data).toEqual([15_000_000, 15_000_000, 15_700_000, 15_000_000]);
  });

  it("sin meses proyectados no dibuja el fondo del futuro", () => {
    const solo = opcionCobros({ ...cobros, meses: cobros.meses.slice(0, 2) }, theme);
    expect(serie(solo, "fondo:futuro").markArea).toBeUndefined();
  });
});

describe("formatos", () => {
  it("escribe millones, ejes y años como el lienzo", () => {
    expect(millonesCorto(6_060_000)).toBe("6,1");
    expect(millonesCorto(-1_700_000)).toBe("−1,7");
    expect(ejeCorto(8_000_000)).toBe("8 M");
    expect(ejeCorto(500_000)).toBe("500 mil");
    expect(ejeCorto(0)).toBe("0");
    const meses = ["2025-12", "2026-01", "2026-02"];
    expect(meses.map((_, i) => anioVisible(meses, i))).toEqual(["2025", "2026", ""]);
  });
});
