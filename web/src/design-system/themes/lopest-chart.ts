/**
 * Lopest chart theme: the bridge between the CSS token layers and ECharts.
 *
 * WHY A BRIDGE. ECharts computes colors and sizes into SVG attributes, so it
 * cannot consume `var(--…)`. Lopest's single source of visual values is CSS
 * (`tokens/primitives.css`, `themes/lopest.css`, `tokens/semantic.css`,
 * `tokens/typography.css`). Instead of duplicating those values in
 * TypeScript, this module only names the custom properties a chart needs
 * (`CHART_TOKENS`) and resolves their computed values in the browser
 * (`resolveChartTheme`). Changing a chart color or size therefore means
 * editing the CSS token, never this file and never a view.
 *
 * COLOR ROLES.
 *   - `realized`: money already collected (capital + interest), a contrasting pair.
 *   - `projected`: money still expected, one hue in two strengths, so a
 *     forecast never reads as collected money.
 *   - `grid`, `cursor`, `axisText`, `text`, tooltip surface/border: chart furniture,
 *     quieter than any series.
 *
 * PURITY. Everything here is DOM-free: `resolveChartTheme` receives a reader
 * function, so it is unit-tested without a browser and `Chart` passes
 * `getComputedStyle(document.documentElement).getPropertyValue`.
 */

/** Custom properties the chart theme reads. Values live only in CSS. */
export const CHART_TOKENS = {
  color: {
    realizedPrimary: "--dataviz-realized-primary",
    realizedSecondary: "--dataviz-realized-secondary",
    projectedPrimary: "--dataviz-projected-primary",
    projectedSecondary: "--dataviz-projected-secondary",
    grid: "--dataviz-grid",
    cursor: "--dataviz-cursor",
    axisText: "--dataviz-axis-text",
    text: "--dataviz-text",
    tooltipSurface: "--dataviz-tooltip-surface",
    tooltipBorder: "--dataviz-tooltip-border",
  },
  size: {
    axisFont: "--text-xs",
    labelFont: "--text-xs",
    tooltipFont: "--text-sm",
    barRadius: "--ds-chart-bar-radius",
    axisStroke: "--ds-chart-stroke-axis",
    insetTop: "--ds-chart-inset-top",
    insetSide: "--ds-chart-inset-side",
    insetStart: "--ds-chart-inset-start",
    insetBottom: "--ds-chart-inset-bottom",
    legendGap: "--ds-chart-legend-gap",
    legendReserve: "--ds-chart-legend-reserve",
    animationDuration: "--ds-duration-slow",
    lineStroke: "--ds-chart-line-stroke",
    symbol: "--ds-chart-symbol",
    markStroke: "--ds-chart-mark-stroke",
    barMax: "--ds-chart-bar-max",
    tickWidth: "--ds-chart-tick-width",
    labelWeight: "--font-weight-semibold",
    axisWeight: "--font-weight-medium",
  },
  dash: { grid: "--ds-chart-grid-dash" },
  /**
   * Casa y Negocio palette (approved canvas): Negocio ink, Casa teal, Ahorro
   * gold, a faint ink for what is still expected, and an ink tooltip like the
   * module's popovers. Same furniture sizes as the base theme.
   */
  casaNegocio: {
    negocio: "--dataviz-cn-negocio",
    negocioSoft: "--dataviz-cn-negocio-soft",
    casa: "--dataviz-cn-casa",
    casaSoft: "--dataviz-cn-casa-soft",
    ahorro: "--dataviz-cn-ahorro",
    projected: "--dataviz-cn-projected",
    grid: "--dataviz-cn-grid",
    cursor: "--dataviz-cn-cursor",
    axisText: "--dataviz-cn-axis-text",
    text: "--dataviz-cn-text",
    tooltipSurface: "--dataviz-cn-tooltip-surface",
    tooltipText: "--dataviz-cn-tooltip-text",
    projectedCapital: "--dataviz-cn-projected-capital",
    projectedInteres: "--dataviz-cn-projected-interes",
    today: "--dataviz-cn-today",
    alert: "--dataviz-cn-alert",
    futureGround: "--dataviz-cn-future-ground",
    surface: "--dataviz-cn-surface",
  },
} as const;

/**
 * Which palette a chart is drawn with. `lopest` is the current app; the
 * `casa-negocio` palette belongs to the new visual language and is used only
 * inside /casa-negocio until the rest of the app is redesigned.
 */
export type ChartPalette = "lopest" | "casa-negocio";

/**
 * CSS-only tokens a chart uses through classes or inline `var()` (the HTML
 * tooltip box and the drawing-area box), which never need resolution.
 */
export const CHART_CSS = {
  tooltipRadius: "var(--ds-radius-sm)",
  tooltipShadow: "var(--ds-shadow-overlay)",
} as const;

type ColorRole = keyof typeof CHART_TOKENS.color;
type CasaNegocioRole = keyof typeof CHART_TOKENS.casaNegocio;
type SizeRole = keyof typeof CHART_TOKENS.size;

/** Resolved values: what an ECharts option can actually use. */
export type ChartTheme = {
  color: Record<ColorRole, string>;
  casaNegocio: Record<CasaNegocioRole, string>;
  size: Record<SizeRole, number>;
  dash: { grid: number[] };
  fontFamily: string;
};

/**
 * Converts a computed CSS length/time to a plain number.
 * Custom properties are untyped, so `rem` is not resolved by the browser:
 * it is multiplied by the root font size here. `px`, `ms` and unitless
 * values are taken as-is; anything unparsable becomes 0 so a missing token
 * degrades to "no size" instead of `NaN` reaching ECharts.
 */
export function toNumber(raw: string, rootFontSizePx: number): number {
  const value = raw.trim();
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  if (value.endsWith("rem")) return parsed * rootFontSizePx;
  if (value.endsWith("ms")) return parsed;
  if (value.endsWith("s")) return parsed * 1000;
  return parsed;
}

/** Parses a space-separated dash pattern token (`3 3`) into ECharts' `number[]`. */
export function toDash(raw: string): number[] {
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((part) => Number.isFinite(part));
}

function mapRoles<K extends string, V>(names: Record<K, string>, convert: (raw: string) => V): Record<K, V> {
  return Object.fromEntries(
    (Object.entries(names) as [K, string][]).map(([role, variable]) => [role, convert(variable)]),
  ) as Record<K, V>;
}

/**
 * Resolves every chart token through `read` (a custom-property reader).
 * `fontFamily` is passed already resolved: `next/font` publishes Geist under
 * a hashed family name, so the browser's computed `body` font is the truth.
 */
export function resolveChartTheme(
  read: (variable: string) => string,
  rootFontSizePx: number,
  fontFamily: string,
): ChartTheme {
  return {
    color: mapRoles(CHART_TOKENS.color, (variable) => read(variable).trim()),
    casaNegocio: mapRoles(CHART_TOKENS.casaNegocio, (variable) => read(variable).trim()),
    size: mapRoles(CHART_TOKENS.size, (variable) => toNumber(read(variable), rootFontSizePx)),
    dash: { grid: toDash(read(CHART_TOKENS.dash.grid)) },
    fontFamily,
  };
}

/**
 * Furniture colors per palette. `series` is the default order ECharts gives
 * to series an option does not color itself.
 */
function paletteColors(theme: ChartTheme, palette: ChartPalette) {
  if (palette === "casa-negocio") {
    const c = theme.casaNegocio;
    return {
      series: [c.negocio, c.casa, c.ahorro, c.negocioSoft, c.casaSoft, c.projected],
      grid: c.grid,
      cursor: c.cursor,
      axisText: c.axisText,
      text: c.text,
      tooltipSurface: c.tooltipSurface,
      tooltipBorder: c.tooltipSurface,
      tooltipText: c.tooltipText,
    };
  }
  const c = theme.color;
  return {
    series: [c.realizedPrimary, c.realizedSecondary, c.projectedPrimary, c.projectedSecondary],
    grid: c.grid,
    cursor: c.cursor,
    axisText: c.axisText,
    text: c.text,
    tooltipSurface: c.tooltipSurface,
    tooltipBorder: c.tooltipBorder,
    tooltipText: c.text,
  };
}

/** Name under which `Chart` registers each palette's ECharts theme. */
export function echartsThemeName(palette: ChartPalette): string {
  return palette === "lopest" ? "lopest" : `lopest-${palette}`;
}

/**
 * The ECharts theme object, registered once per palette by `Chart`. Whatever
 * an option does not set falls back to these values, which is what keeps
 * every chart of the app alike: options declare data and roles, not furniture.
 */
export function buildEchartsTheme(theme: ChartTheme, palette: ChartPalette = "lopest") {
  const { size: s, fontFamily } = theme;
  const c = paletteColors(theme, palette);
  const axisLabel = { color: c.axisText, fontSize: s.axisFont, fontFamily };
  return {
    color: c.series,
    backgroundColor: "transparent",
    textStyle: { fontFamily, fontSize: s.labelFont, color: c.text },
    animationDuration: s.animationDuration,
    // ECharts names easings itself; cubicOut is its closest match to --ds-easing-standard.
    animationEasing: "cubicOut",
    categoryAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel,
      splitLine: { show: true, lineStyle: { color: c.grid, width: s.axisStroke, type: theme.dash.grid } },
    },
    tooltip: {
      backgroundColor: c.tooltipSurface,
      borderColor: c.tooltipBorder,
      borderWidth: s.axisStroke,
      textStyle: { color: c.tooltipText, fontSize: s.tooltipFont, fontFamily },
      // The tooltip is an HTML box, so it can consume CSS tokens directly.
      extraCssText: `border-radius: ${CHART_CSS.tooltipRadius}; box-shadow: ${CHART_CSS.tooltipShadow};`,
      axisPointer: { type: "shadow", shadowStyle: { color: c.cursor } },
    },
    legend: { textStyle: { color: c.text, fontSize: s.labelFont, fontFamily } },
  };
}
