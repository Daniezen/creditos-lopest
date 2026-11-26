"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import type { BarSeriesOption, LineSeriesOption, ScatterSeriesOption } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import type {
  GridComponentOption,
  LegendComponentOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import * as echarts from "echarts/core";
import type { ComposeOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

import { dataVizRecipes } from "../recipes/data-viz";
import {
  buildEchartsTheme,
  echartsThemeName,
  resolveChartTheme,
  type ChartPalette,
  type ChartTheme,
} from "../themes/lopest-chart";

/**
 * The one way Lopest draws a chart: Apache ECharts, pinned to 6.0.0 (the
 * same pin as the sibling platforms), behind this component.
 *
 * BUNDLE. ECharts is imported by module from `echarts/core`; only the types
 * registered below reach the client (bars, lines, scatter marks, grid,
 * tooltip, legend, mark lines and areas). A chart
 * that needs another type adds it here, deliberately, and to `ChartOption`,
 * instead of importing the full `echarts` package elsewhere. The SVG renderer
 * keeps charts sharp at any zoom, printable, and their text as text.
 *
 * THEME. Built once, at first mount, from the CSS tokens
 * (`themes/lopest-chart.ts`) and registered per palette (`echartsThemeName`). An option never
 * writes colors or sizes of its own: when it needs a role (which series is
 * "projected", the bar radius) it receives the resolved `ChartTheme` by
 * passing `option` as a function.
 *
 * SIZE. Width is the container's, followed with a `ResizeObserver` (phones,
 * a folding sidebar, a scroll canvas); height is a token class, so the page
 * does not jump while charts mount. `scroll` opts into a horizontal scroll
 * canvas sized per category, for long monthly series.
 *
 * ACCESSIBILITY. The drawing is an image (`role="img"`) labelled with what it
 * shows. Reduced motion disables animation; the preference is read when an
 * option is applied, so no media-query subscription is kept per chart.
 */

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  SVGRenderer,
]);

/** The option a chart may declare: only registered types compile. */
export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | MarkAreaComponentOption
>;

export type { ChartPalette, ChartTheme };

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
let resolvedTheme: ChartTheme | null = null;
const registeredPalettes = new Set<ChartPalette>();

/**
 * Resolves the tokens once per page load (they do not change at runtime) and
 * registers each palette's ECharts theme the first time a chart asks for it.
 */
function ensureTheme(palette: ChartPalette = "lopest"): ChartTheme {
  if (!resolvedTheme) {
    const rootStyles = getComputedStyle(document.documentElement);
    resolvedTheme = resolveChartTheme(
      (variable) => rootStyles.getPropertyValue(variable),
      Number.parseFloat(rootStyles.fontSize) || 16,
      getComputedStyle(document.body).fontFamily,
    );
  }
  if (!registeredPalettes.has(palette)) {
    echarts.registerTheme(echartsThemeName(palette), buildEchartsTheme(resolvedTheme, palette));
    registeredPalettes.add(palette);
  }
  return resolvedTheme;
}

const HEIGHT = { regular: dataVizRecipes.heightRegular, compact: dataVizRecipes.heightCompact } as const;

export type ChartHeight = keyof typeof HEIGHT;

export type ChartScroll = {
  /** Number of categories on the x axis: one slot token each. */
  categories: number;
  /** Which end is visible first: `end` anchors on the latest month. */
  anchor: "start" | "end";
};

export type ChartProps = {
  /** A static option, or a builder that receives the resolved theme roles. Memoize it. */
  option: ChartOption | ((theme: ChartTheme) => ChartOption);
  height: ChartHeight;
  /** What the chart shows, for assistive technology: «Recaudación mensual de capital e interés». */
  label: string;
  scroll?: ChartScroll;
  className?: string;
  /** Palette of the theme; `casa-negocio` only inside that module. Fixed for the chart's life. */
  palette?: ChartPalette;
};

export function Chart({ option, height, label, scroll, className, palette = "lopest" }: ChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Mount/unmount: one instance per element, resized with its container.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    ensureTheme(palette);
    const chart = echarts.init(element, echartsThemeName(palette), { renderer: "svg" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // The palette is part of the instance; a chart never switches palettes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every option change replaces the previous one (`notMerge`): a chart is a
  // function of its data, and a merge would keep series the new data lacks.
  // Declared after the mount effect, so the instance already exists here.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const resolved = typeof option === "function" ? option(ensureTheme(palette)) : option;
    const reduced = window.matchMedia(REDUCED_MOTION).matches;
    chart.setOption({ ...resolved, animation: !reduced }, { notMerge: true });
  }, [option, palette]);

  const drawing = (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={[dataVizRecipes.drawing, HEIGHT[height], scroll ? "" : className ?? ""].join(" ").trim()}
    />
  );

  if (!scroll) return drawing;

  const trackClass = [
    dataVizRecipes.scrollTrack,
    scroll.anchor === "end" ? dataVizRecipes.scrollTrackFromEnd : "",
    className ?? "",
  ]
    .join(" ")
    .trim();
  // The category count is data, not a visual value: it feeds the canvas recipe's calc().
  const canvasStyle = { "--chart-categories": scroll.categories } as CSSProperties;

  return (
    <div className={trackClass}>
      <div className={dataVizRecipes.scrollCanvas} style={canvasStyle}>
        {drawing}
      </div>
    </div>
  );
}

/** Placeholder with the drawing's footprint, for a chart with no data. */
export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className={dataVizRecipes.emptyState}>
      <p className={dataVizRecipes.emptyStateText}>{message}</p>
    </div>
  );
}
