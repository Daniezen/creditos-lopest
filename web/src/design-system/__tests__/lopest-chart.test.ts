import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEchartsTheme, CHART_TOKENS, resolveChartTheme, toDash, toNumber } from "../themes/lopest-chart";

const DS = join(__dirname, "..");
const CSS = ["tokens/primitives.css", "themes/lopest.css", "tokens/semantic.css", "tokens/typography.css"]
  .map((file) => readFileSync(join(DS, file), "utf8"))
  .join("\n");

/** Minimal custom-property reader over the real token files, following var() chains like the browser does. */
function readToken(variable: string, depth = 0): string {
  const match = new RegExp(`${variable}:\\s*([^;]+);`).exec(CSS);
  if (!match) return "";
  const value = match[1].trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref && depth < 8 ? readToken(ref[1], depth + 1) : value;
}

describe("toNumber", () => {
  it("converts rem with the root font size and keeps px/ms", () => {
    expect(toNumber("0.75rem", 16)).toBe(12);
    expect(toNumber(" 4px", 16)).toBe(4);
    expect(toNumber("400ms", 16)).toBe(400);
    expect(toNumber("0.4s", 16)).toBe(400);
  });

  it("degrades a missing token to 0 instead of NaN", () => {
    expect(toNumber("", 16)).toBe(0);
  });
});

describe("toDash", () => {
  it("parses a space-separated dash pattern", () => {
    expect(toDash(" 3 3 ")).toEqual([3, 3]);
  });
});

describe("resolveChartTheme over the real tokens", () => {
  const theme = resolveChartTheme(readToken, 16, "Geist");

  it("defines every chart token in CSS", () => {
    const names = [...Object.values(CHART_TOKENS.color), ...Object.values(CHART_TOKENS.size), CHART_TOKENS.dash.grid];
    expect(names.filter((name) => readToken(name) === "")).toEqual([]);
  });

  it("resolves colors to concrete values and sizes to numbers", () => {
    for (const value of Object.values(theme.color)) expect(value).toMatch(/^#|^rgb/);
    expect(theme.size.axisFont).toBe(12);
    expect(theme.size.tooltipFont).toBe(14);
    expect(theme.dash.grid).toEqual([3, 3]);
  });

  it("feeds the palette and furniture of the ECharts theme", () => {
    const echartsTheme = buildEchartsTheme(theme);
    expect(echartsTheme.color[0]).toBe(theme.color.realizedPrimary);
    expect(echartsTheme.valueAxis.splitLine.lineStyle.type).toEqual([3, 3]);
    expect(echartsTheme.textStyle.fontFamily).toBe("Geist");
  });
});
