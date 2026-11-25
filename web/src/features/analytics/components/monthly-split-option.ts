import type { ChartOption, ChartTheme } from "@/design-system";
import { formatCurrencyCOP, formatCurrencyCompactCOP, formatMonthLabelCO } from "@/lib/formatters";

/** A month split into the two money components every analytics chart shows. */
export type MonthlySplit = { mesStr: string; capital: number; interes: number };

/** Which pair of theme color roles paints the stack. */
export type MonthlySplitTone = "realized" | "projected";

export type MonthlySplitLabels = { capital: string; interes: string };

/**
 * Builds the stacked monthly bar option shared by the historic and the
 * projection charts: capital at the base, interest on top, one category per
 * `YYYY-MM` key in the order the query returned them.
 *
 * Colors and geometry come from the resolved theme (`tone` picks the role
 * pair); labels use the app formatters, so the axis, tooltip and the rest of
 * the report read money and months the same way.
 */
export function buildMonthlySplitOption(
  rows: MonthlySplit[],
  labels: MonthlySplitLabels,
  tone: MonthlySplitTone,
  theme: ChartTheme,
): ChartOption {
  const { color, size } = theme;
  const primary = tone === "realized" ? color.realizedPrimary : color.projectedPrimary;
  const secondary = tone === "realized" ? color.realizedSecondary : color.projectedSecondary;
  const r = size.barRadius;

  return {
    grid: {
      top: size.insetTop,
      right: size.insetSide,
      left: size.insetStart,
      bottom: size.insetBottom + size.legendGap + size.legendReserve,
      // ECharts 6 replacement of `containLabel`: axis labels stay inside the box.
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel",
    },
    legend: { bottom: size.insetBottom },
    tooltip: { trigger: "axis", valueFormatter: (value) => formatCurrencyCOP(Number(value)) },
    xAxis: {
      type: "category",
      data: rows.map((row) => formatMonthLabelCO(row.mesStr)),
      // Every month is labelled: the scroll canvas guarantees room for each one.
      axisLabel: { interval: 0 },
    },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => formatCurrencyCompactCOP(value) } },
    series: [
      {
        type: "bar",
        name: labels.capital,
        stack: "monto",
        data: rows.map((row) => row.capital),
        itemStyle: { color: primary, borderRadius: [0, 0, r, r] },
      },
      {
        type: "bar",
        name: labels.interes,
        stack: "monto",
        data: rows.map((row) => row.interes),
        itemStyle: { color: secondary, borderRadius: [r, r, 0, 0] },
      },
    ],
  };
}
