import { describe, expect, it } from "vitest";

import { demoTablero } from "../fixtures/canvas-noviembre";
import { QUICK_ENTRY_KINDS, quickEntryFields } from "../header/quick-entry";
import { CASA_NEGOCIO_TABS, CASA_NEGOCIO_TAB_GROUPS } from "../header/tabs";
import { formatMillions, formatMoney } from "../shared/format";
import { calendarCells } from "../tablero/calendar-grid";
import { envelopeFillPct, envelopeState } from "../tablero/envelope-state";
import { moneyPathSteps } from "../tablero/money-path-geometry";
import type { QuickEntryOptions } from "../types";

describe("formatMoney / formatMillions", () => {
  it("writes pesos as the canvas does, with a true minus sign", () => {
    expect(formatMoney(1_787_000)).toBe("$ 1.787.000");
    expect(formatMoney(-1_499_000)).toBe("−$ 1.499.000");
    expect(formatMoney(0)).toBe("$ 0");
    expect(formatMillions(6_240_000)).toBe("$ 6,2 M");
    expect(formatMillions(186_400_000)).toBe("$ 186,4 M");
  });
});

describe("calendarCells", () => {
  it("starts November 2026 (a Sunday) after six blanks and keeps whole weeks", () => {
    const cells = calendarCells(2026, 11);
    expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(30);
    expect(cells.length % 7).toBe(0);
    expect(cells.includes(30)).toBe(true);
  });

  it("handles a month that starts on Monday and a leap February", () => {
    expect(calendarCells(2027, 2)[0]).toBe(1);
    expect(calendarCells(2028, 2).filter(Boolean)).toHaveLength(29);
  });
});

describe("envelopeState", () => {
  it("is fine below the threshold, near from 90 % and past over the cap", () => {
    expect(envelopeState(1_210_000, 2_700_000)).toBe("ok");
    expect(envelopeState(186_000, 200_000)).toBe("cerca");
    expect(envelopeState(200_000, 200_000)).toBe("cerca");
    expect(envelopeState(72_000, 50_000)).toBe("pasado");
    expect(envelopeState(80, 100, 0.8)).toBe("cerca");
  });

  it("treats a zero cap sensibly and never overflows the bar", () => {
    expect(envelopeState(0, 0)).toBe("ok");
    expect(envelopeState(1, 0)).toBe("pasado");
    expect(envelopeFillPct(72_000, 50_000)).toBe(100);
    expect(envelopeFillPct(312_000, 470_000)).toBe(66);
  });
});

describe("moneyPathSteps", () => {
  const steps = moneyPathSteps(demoTablero.moneyPath);
  const base = 16_040_000;

  it("totals the canvas month", () => {
    expect(steps.map((step) => step.total)).toEqual([base, base, 5_500_000]);
    expect(steps[1].note).toBe("Incluye gastos por $ 0,2 M");
  });

  it("puts step 3 right under «A la casa», as wide as it, with the teal arrow at its centre", () => {
    const beforeHouse = (3_000_000 + 180_000) / base;
    expect(steps[2].offsetPct).toBeCloseTo(beforeHouse * 100, 6);
    expect(steps[2].widthPct).toBeCloseTo((5_500_000 / base) * 100, 6);
    expect(steps[1].arrow).toEqual({ atPct: expect.closeTo((beforeHouse + 2_750_000 / base) * 100, 6), tone: "casa" });
  });

  it("captions only parts of at least 5 % and drops empty ones", () => {
    const gastos = steps[1].parts.find((part) => part.key === "gastos");
    expect(gastos?.showLabel).toBe(false);
    expect(steps[2].parts.map((part) => [part.key, part.showLabel])).toEqual([
      ["fijos", true],
      ["variables", true],
      ["sobra", true],
    ]);
    const noExpenses = moneyPathSteps({ ...demoTablero.moneyPath, left: { ...demoTablero.moneyPath.left, expenses: 0 } });
    expect(noExpenses[1].parts.map((part) => part.key)).not.toContain("gastos");
    expect(noExpenses[1].note).toBeUndefined();
  });

  it("flags an overspent house and widens step 3 to what was used", () => {
    const over = moneyPathSteps({
      ...demoTablero.moneyPath,
      house: { fixed: 4_000_000, variable: 2_000_000, surplus: -500_000 },
    });
    expect(over[2]).toMatchObject({ note: "Faltaron $ 0,5 M", noteTone: "problem" });
    expect(over[2].widthPct).toBeCloseTo((6_000_000 / base) * 100, 6);
    expect(over[2].parts.map((part) => part.key)).toEqual(["fijos", "variables"]);
  });
});

describe("quick entry", () => {
  const o = (prefix: string) => [{ value: `${prefix}-1`, label: `${prefix} 1` }];
  const options: QuickEntryOptions = {
    categoriasCasa: o("cat"),
    origenesIngresoCasa: o("ing"),
    conceptosNegocio: o("con"),
    origenesAporte: o("apo"),
    cuentasNegocio: o("neg"),
    cuentasCasa: o("casa"),
    cuentasTodas: o("todas"),
    saldos: {},
    nombresCuenta: {},
    avisoSinSaldo: true,
  };

  it("offers the six movement types of the spec", () => {
    expect(QUICK_ENTRY_KINDS.map((def) => def.label)).toEqual([
      "Gasto de la casa",
      "Ingreso de la casa",
      "Gasto del negocio",
      "Aporte",
      "A la casa",
      "Traslado",
    ]);
  });

  it("draws each type's two fields from the right lists", () => {
    const sources = Object.fromEntries(
      QUICK_ENTRY_KINDS.map(({ kind }) => [kind, quickEntryFields(kind, options).map((f) => `${f.name}:${f.options[0].value}`)]),
    );
    expect(sources).toEqual({
      gastoCasa: ["categoria:cat-1", "cuentaOrigen:casa-1"],
      ingresoCasa: ["origen:ing-1", "cuentaDestino:casa-1"],
      gastoNegocio: ["concepto:con-1", "cuentaOrigen:neg-1"],
      aporte: ["origen:apo-1", "cuentaDestino:neg-1"],
      retiro: ["cuentaOrigen:neg-1", "cuentaDestino:casa-1"],
      traslado: ["cuentaOrigen:todas-1", "cuentaDestino:todas-1"],
    });
  });
});

describe("tabs", () => {
  it("come in the spec's order and three groups", () => {
    expect(CASA_NEGOCIO_TAB_GROUPS.map((group) => group.map((tab) => tab.label))).toEqual([
      ["Tablero", "Resumen"],
      ["Casa", "Negocio", "Ahorro", "Arqueo"],
      ["Configuración"],
    ]);
    expect(CASA_NEGOCIO_TABS.filter((tab) => tab.identity).map((tab) => tab.identity)).toEqual(["casa", "negocio", "ahorro"]);
  });
});
