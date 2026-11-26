import type { ChartOption, ChartTheme } from "@/design-system";
import { pesos } from "@/features/casa-negocio/domain";
import type { BarraAhorro } from "@/server/casa-negocio/vista-ahorro";

/**
 * ECharts option of «Lo que entró cada mes» (`Ahorro.dc.html`): one gold bar
 * per month with its short value on top («7 M», «631 mil», «—»), empty
 * months as a faint stub, and the selected month's pending cierre drawn as
 * an outline (soft gold fill, gold edge). No y axis: the labels carry the
 * numbers, as in the canvas. Colors and sizes come from the resolved theme.
 */
export function buildDepositsOption(barras: readonly BarraAhorro[], theme: ChartTheme): ChartOption {
  const c = theme.casaNegocio;
  const { size } = theme;
  const r = size.barRadius;

  return {
    grid: {
      top: size.insetTop,
      right: 0,
      left: 0,
      bottom: size.insetBottom,
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel",
    },
    tooltip: {
      trigger: "item",
      valueFormatter: (value) => pesos(Math.round(Number(value))),
    },
    xAxis: {
      type: "category",
      data: barras.map((b) => b.etiqueta),
      axisLabel: { interval: 0, color: c.axisText },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: "value", show: false, splitLine: { show: false } },
    series: [
      {
        type: "bar",
        name: "Entró al ahorro",
        barMaxWidth: size.barMaxWidth,
        barMinHeight: size.barMinHeight,
        data: barras.map((b) => ({
          value: b.valor,
          itemStyle: b.pendiente
            ? { color: c.ahorroSoft, borderColor: c.ahorro, borderWidth: size.outlineStroke, borderRadius: [r * 2, r * 2, r, r] }
            : { color: b.valor > 0 ? c.ahorro : c.empty, borderRadius: [r * 2, r * 2, r, r] },
          label: { show: true, position: "top", color: c.axisText, fontSize: size.labelFont, formatter: () => b.texto },
        })),
      },
    ],
  };
}
