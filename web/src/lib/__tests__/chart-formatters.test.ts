import { describe, expect, it } from "vitest";
import { formatCurrencyCompactCOP, formatMonthLabelCO } from "../formatters";

describe("formatMonthLabelCO", () => {
  it("labels a YYYY-MM key with the same month, never the previous one", () => {
    // Midday parse: no timezone offset can move the 1st back into the prior month.
    expect(formatMonthLabelCO("2026-01")).toBe("ene 2026");
    expect(formatMonthLabelCO("2026-12")).toBe("dic 2026");
  });
});

describe("formatCurrencyCompactCOP", () => {
  it("keeps the axis abbreviations the charts used before", () => {
    expect(formatCurrencyCompactCOP(1_500_000)).toBe("$1.5M");
    expect(formatCurrencyCompactCOP(250_000)).toBe("$250k");
    expect(formatCurrencyCompactCOP(900)).toBe("$900");
    expect(formatCurrencyCompactCOP(0)).toBe("$0");
  });
});
