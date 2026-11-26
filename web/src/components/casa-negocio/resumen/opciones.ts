/**
 * ECharts options of the Resumen charts, as pure functions of the view model
 * (`server/casa-negocio/vista-resumen.ts`) and the resolved theme. No DOM:
 * unit-tested directly, and every color or size comes from `ChartTheme`.
 *
 * TWO X AXES. Both charts draw their series on a category axis (one band per
 * month) and lay a hidden VALUE axis over it, ranging [-0.5, n - 0.5]. On
 * that axis band `i` spans exactly [i - 0.5, i + 0.5], so marks that live
 * BETWEEN or ACROSS whole bands — the HOY line between the last collected
 * month and the first projected one, the red ground of a month whose capital
 * shrank, the warm ground behind the future — are placed by number instead of
 * by category, which ECharts would pin to the band's centre.
 */
import type { ChartOption, ChartTheme } from "@/design-system";

import type { CobrosVista, GananciaVista } from "@/server/casa-negocio/vista-resumen";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
const MINUS = "−";

export function mesCorto(mes: string): string {
  return MESES_CORTOS[Number(mes.slice(5, 7)) - 1];
}

/** The year is written under the first month and under every January. */
export function anioVisible(meses: readonly string[], i: number): string {
  return i === 0 || meses[i].endsWith("-01") ? meses[i].slice(0, 4) : "";
}

/** «4,2» (millions, one decimal) for the values printed on the drawing. */
export function millonesCorto(pesos: number): string {
  const sign = pesos < 0 ? MINUS : "";
  return sign + (Math.abs(pesos) / 1e6).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Axis ticks: «0», «4 M», «500 mil». */
export function ejeCorto(pesos: number): string {
  if (pesos === 0) return "0";
  const abs = Math.abs(pesos);
  const sign = pesos < 0 ? MINUS : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  return `${sign}${Math.round(abs / 1e3).toLocaleString("es-CO")} mil`;
}

/** Whole pesos for tooltips: «$ 1.787.000». */
export function pesosLargo(pesos: number): string {
  const sign = pesos < 0 ? MINUS : "";
  return `${sign}$ ${Math.round(Math.abs(pesos)).toLocaleString("es-CO")}`;
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Tooltip body: a title and label/value rows. Text only, escaped. */
function tooltipHtml(titulo: string, filas: readonly [string, string][], nota?: string): string {
  const cuerpo = filas.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${escapar(k)}</span><b>${escapar(v)}</b></div>`).join("");
  return `<div><div style="margin-bottom:4px;opacity:.75">${escapar(titulo)}</div>${cuerpo}${nota ? `<div style="margin-top:4px;opacity:.75">${escapar(nota)}</div>` : ""}</div>`;
}

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function tituloMes(mes: string): string {
  const n = NOMBRES_MES[Number(mes.slice(5, 7)) - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} ${mes.slice(0, 4)}`;
}

/** Index of the hovered month from an axis tooltip's params. */
function indiceDe(params: unknown): number {
  const lista = Array.isArray(params) ? params : [params];
  const p = lista.find((x): x is { dataIndex: number; seriesId?: string } => typeof x === "object" && x !== null && "dataIndex" in x && String((x as { seriesId?: string }).seriesId ?? "").startsWith("m:"));
  return p ? p.dataIndex : -1;
}

function gridBase(theme: ChartTheme, bottomExtra = 0) {
  const s = theme.size;
  return {
    top: s.insetTop + s.labelFont * 1.5,
    right: s.insetSide / 2,
    left: s.insetStart,
    bottom: s.insetBottom + bottomExtra,
    outerBoundsMode: "same" as const,
    outerBoundsContain: "axisLabel" as const,
  };
}

/** The hidden numeric axis laid over the category bands (see header). */
function ejeSuperpuesto(n: number) {
  return { type: "value" as const, min: -0.5, max: n - 0.5, show: false, gridIndex: 0 };
}

// ---------------------------------------------------------------------------
// Ganancia y retiros
// ---------------------------------------------------------------------------

export function opcionGanancia(vista: GananciaVista, theme: ChartTheme): ChartOption {
  const c = theme.casaNegocio;
  const s = theme.size;
  const meses = vista.meses.map((m) => m.mes);
  const n = meses.length;

  return {
    grid: gridBase(theme),
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const m = vista.meses[indiceDe(params)];
        if (!m) return "";
        const filas: [string, string][] = [["Ganancia neta", pesosLargo(m.ganancia)]];
        if (m.retiros !== null) filas.push(["A la casa", pesosLargo(m.retiros)]);
        if (m.reinvertido !== null) filas.push(["Reinvertido", pesosLargo(m.reinvertido)]);
        const nota = !m.anotado ? "Antes de Casa y Negocio: solo intereses, sin retiros anotados" : m.capitalBajo ? "El capital bajó" : undefined;
        return tooltipHtml(tituloMes(m.mes), filas, nota);
      },
    },
    xAxis: [
      {
        type: "category",
        data: meses,
        axisLabel: {
          interval: 0,
          formatter: (mes: string) => {
            const m = vista.meses[meses.indexOf(mes)];
            const sub = m?.retiros === null ? "casa —" : `casa ${millonesCorto(m?.retiros ?? 0)}`;
            return `{mes|${mesCorto(mes)}}\n{sub|${sub}}`;
          },
          rich: {
            mes: { color: c.text, fontWeight: s.axisWeight, fontSize: s.tooltipFont, lineHeight: s.tooltipFont * 1.5 },
            sub: { color: c.axisText, fontSize: s.axisFont },
          },
        },
      },
      ejeSuperpuesto(n),
    ],
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => ejeCorto(v) }, splitNumber: 3 },
    series: [
      {
        id: "m:retiros",
        name: "A la casa",
        type: "bar",
        data: vista.meses.map((m) => m.retiros ?? 0),
        barMaxWidth: s.barMax,
        itemStyle: { color: c.casa, borderRadius: [s.barRadius, s.barRadius, 0, 0] },
        z: 2,
      },
      {
        id: "m:ganancia",
        name: "Ganancia neta",
        type: "line",
        data: vista.meses.map((m) => m.ganancia),
        symbol: "circle",
        symbolSize: s.symbol,
        lineStyle: { color: c.negocio, width: s.lineStroke, join: "round" },
        itemStyle: { color: c.surface, borderColor: c.negocio, borderWidth: s.markStroke },
        label: {
          show: true,
          position: "top",
          color: c.text,
          fontSize: s.labelFont,
          fontWeight: s.labelWeight,
          formatter: (p: { value?: unknown }) => millonesCorto(Number(p.value)),
        },
        z: 3,
      },
      {
        id: "fondo:capital-bajo",
        type: "line",
        xAxisIndex: 1,
        data: [[0, 0]],
        symbol: "none",
        lineStyle: { opacity: 0 },
        silent: true,
        tooltip: { show: false },
        markArea: {
          silent: true,
          itemStyle: { color: c.alert },
          data: vista.meses.flatMap((m, i) => (m.capitalBajo ? [[{ xAxis: i - 0.5 }, { xAxis: i + 0.5 }]] : [])) as never,
        },
        z: 1,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Cobros: lo que entró y lo que viene
// ---------------------------------------------------------------------------

/** A short dashed horizontal tick, stretched to the symbol size. */
const TICK_DASHED = "path://M0,0h5v1h-5zM8,0h5v1h-5zM16,0h5v1h-5zM24,0h5v1h-5zM32,0h5v1h-5z";

export function opcionCobros(vista: CobrosVista, theme: ChartTheme): ChartOption {
  const c = theme.casaNegocio;
  const s = theme.size;
  const meses = vista.meses.map((m) => m.mes);
  const n = meses.length;
  const hoy = vista.indiceHoy - 0.5;
  const futuro = { borderColor: c.projected, borderWidth: s.axisStroke, borderType: "dashed" as const };

  return {
    grid: gridBase(theme),
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const m = vista.meses[indiceDe(params)];
        if (!m) return "";
        const filas: [string, string][] = [
          ["Interés", pesosLargo(m.interes)],
          ["Capital", pesosLargo(m.capital)],
          [m.proyectado ? "Viene" : "Cobrado", pesosLargo(m.total)],
        ];
        if (m.esperado !== null) filas.push(["Tocaba cobrar", pesosLargo(m.esperado)]);
        const nota = m.proyectado ? "Si todos pagan a tiempo" : m.cumplimiento !== null ? `${m.cumplimiento} % de lo que tocaba` : undefined;
        return tooltipHtml(tituloMes(m.mes), filas, nota);
      },
    },
    xAxis: [
      {
        type: "category",
        data: meses,
        axisLabel: {
          interval: 0,
          formatter: (mes: string) => {
            const i = meses.indexOf(mes);
            const estilo = vista.meses[i]?.proyectado ? "fut" : "mes";
            return `{${estilo}|${mesCorto(mes)}}\n{anio|${anioVisible(meses, i) || " "}}`;
          },
          rich: {
            mes: { color: c.text, fontWeight: s.axisWeight, fontSize: s.tooltipFont, lineHeight: s.tooltipFont * 1.5 },
            fut: { color: c.axisText, fontWeight: s.axisWeight, fontSize: s.tooltipFont, lineHeight: s.tooltipFont * 1.5 },
            anio: { color: c.projected, fontSize: s.axisFont },
          },
        },
      },
      ejeSuperpuesto(n),
    ],
    yAxis: { type: "value", axisLabel: { formatter: (v: number) => ejeCorto(v) }, splitNumber: 3 },
    series: [
      {
        id: "m:capital",
        name: "Capital",
        type: "bar",
        stack: "cobro",
        barMaxWidth: s.barMax,
        data: vista.meses.map((m) => ({
          value: m.capital,
          itemStyle: m.proyectado
            ? { color: c.projectedCapital, ...futuro, borderRadius: [0, 0, s.barRadius, s.barRadius] }
            : { color: c.negocioSoft, borderRadius: [0, 0, s.barRadius, s.barRadius] },
        })),
        z: 2,
      },
      {
        id: "m:interes",
        name: "Interés",
        type: "bar",
        stack: "cobro",
        barMaxWidth: s.barMax,
        data: vista.meses.map((m) => ({
          value: m.interes,
          itemStyle: m.proyectado
            ? { color: c.projectedInteres, ...futuro, borderRadius: [s.barRadius, s.barRadius, 0, 0] }
            : { color: c.negocio, borderRadius: [s.barRadius, s.barRadius, 0, 0] },
        })),
        z: 2,
      },
      {
        id: "tocaba",
        name: "Lo que tocaba cobrar",
        type: "scatter",
        data: vista.meses.map((m) => (m.esperado === null ? null : m.esperado)),
        symbol: TICK_DASHED,
        symbolSize: [s.tickWidth, s.markStroke],
        itemStyle: { color: c.ahorro },
        silent: true,
        tooltip: { show: false },
        z: 4,
      },
      {
        // Invisible anchor of the total printed above each month: over the
        // bar, or over the «tocaba» tick when collections fell short of it.
        id: "etiquetas",
        type: "scatter",
        data: vista.meses.map((m) => Math.max(m.total, m.esperado ?? 0)),
        symbolSize: 0,
        silent: true,
        tooltip: { show: false },
        label: {
          show: true,
          position: "top",
          color: c.text,
          fontSize: s.labelFont,
          formatter: (p: { dataIndex: number }) => (vista.meses[p.dataIndex]?.total ? millonesCorto(vista.meses[p.dataIndex].total) : ""),
        },
        z: 5,
      },
      {
        id: "fondo:futuro",
        type: "line",
        xAxisIndex: 1,
        data: [[hoy, 0]],
        symbol: "none",
        lineStyle: { opacity: 0 },
        silent: true,
        tooltip: { show: false },
        markArea:
          vista.indiceHoy < n
            ? { silent: true, itemStyle: { color: c.futureGround }, data: [[{ xAxis: hoy }, { xAxis: n - 0.5 }]] as never }
            : undefined,
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: c.today, width: s.markStroke, type: "solid" },
          label: { show: true, position: "end", formatter: "HOY", color: c.today, fontWeight: s.labelWeight, fontSize: s.labelFont },
          data: [{ xAxis: hoy }],
        },
        z: 1,
      },
    ],
  };
}
