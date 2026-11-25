import type { MonthLineData, MonthMark } from "../types";

/**
 * Geometry of the month line (`ModuloTabs.dc.html`), DOM-free so it is unit
 * tested and identical on server and client.
 *
 * POSITION. Day d sits at the centre of its slot: (d − 0.5) / days × 100 %.
 * Marks, HOY and the day numbers all use this one formula, which is what puts
 * HOY exactly on its day and the close exactly on the last one.
 *
 * LABELS THAT NEVER OVERLAP. The canvas dropped a label one line when an
 * earlier mark was within two days. That fails at narrow widths and with long
 * labels, so here each label is an interval of estimated pixels around its
 * mark (characters × an average glyph width, plus a gap) on the track's
 * measured width, and labels are placed greedily, left to right, on the first
 * row where they fit. The estimate errs wide (Geist 11 px medium averages
 * under 6 px per glyph; we use 6.5), so a fit on paper is a fit on screen.
 *
 * SAME-DAY MARKS. Two marks on one day would draw on top of each other; each
 * extra mark of a day is nudged right by one nudge step (a CSS token), and the
 * label intervals account for it.
 */

export const LABEL_CHAR_PX = 6.5;
export const LABEL_GAP_PX = 8;
/** Must match --ds-cn-line-nudge (0.875rem at a 16 px root). */
export const NUDGE_PX = 14;
/** Label rows that fit the base line height (--ds-cn-line-height); more rows grow it. */
export const BASE_LABEL_ROWS = 3;
/** Width assumed before the track is measured (desktop content width). */
export const DEFAULT_TRACK_PX = 1200;

export function dayPercent(day: number, daysInMonth: number): number {
  const clamped = Math.min(Math.max(day, 1), daysInMonth);
  return ((clamped - 0.5) / daysInMonth) * 100;
}

/** A percentage as a CSS length, rounded so server and client strings match. */
export function percentCss(value: number): string {
  return `${value.toFixed(2)}%`;
}

export interface PlacedMark extends MonthMark {
  /** Effective day (the close is moved to the last day). */
  day: number;
  leftPct: number;
  /** How many marks of the same day precede this one. */
  nudge: number;
  /** Label row, 0 = right under the track. */
  row: number;
}

export interface MonthLineLayout {
  marks: PlacedMark[];
  rows: number;
  /** Rows beyond the base height, to grow the line by that many row steps. */
  extraRows: number;
  /** Width of the elapsed part of the track, in %. */
  fillPct: number;
  /** HOY position, or null when the month shown is not the current one. */
  todayPct: number | null;
  ticks: { day: number; leftPct: number }[];
}

interface LayoutOptions {
  trackWidthPx?: number;
  charPx?: number;
  gapPx?: number;
  nudgePx?: number;
}

/** Orders marks by day, keeping the given order within a day; the close always last. */
function ordered(marks: readonly MonthMark[], daysInMonth: number): MonthMark[] {
  return marks
    .map((mark, index) => ({ mark: mark.kind === "cierre" ? { ...mark, day: daysInMonth } : mark, index }))
    .sort((a, b) => {
      const closeA = a.mark.kind === "cierre" ? 1 : 0;
      const closeB = b.mark.kind === "cierre" ? 1 : 0;
      return closeA - closeB || a.mark.day - b.mark.day || a.index - b.index;
    })
    .map(({ mark }) => ({ ...mark, day: Math.min(Math.max(mark.day, 1), daysInMonth) }));
}

export function layoutMonthMarks(
  marks: readonly MonthMark[],
  daysInMonth: number,
  { trackWidthPx = DEFAULT_TRACK_PX, charPx = LABEL_CHAR_PX, gapPx = LABEL_GAP_PX, nudgePx = NUDGE_PX }: LayoutOptions = {},
): { marks: PlacedMark[]; rows: number } {
  const rowsEnd: number[] = [];
  const perDay = new Map<number, number>();

  const placed = ordered(marks, daysInMonth).map((mark) => {
    const nudge = perDay.get(mark.day) ?? 0;
    perDay.set(mark.day, nudge + 1);
    const leftPct = dayPercent(mark.day, daysInMonth);
    const center = (leftPct / 100) * trackWidthPx + nudge * nudgePx;
    const half = (mark.label.length * charPx) / 2;
    const start = center - half;

    let row = rowsEnd.findIndex((end) => start >= end + gapPx);
    if (row === -1) {
      row = rowsEnd.length;
      rowsEnd.push(center + half);
    } else {
      rowsEnd[row] = center + half;
    }
    return { ...mark, leftPct, nudge, row };
  });

  return { marks: placed, rows: rowsEnd.length };
}

/**
 * Day numbers above the track: 1, 5, 10, 15, 20, 25 and the last day, minus
 * any too close to the last day or to HOY (whose label takes that spot).
 */
export function dayTicks(daysInMonth: number, today: number | null): number[] {
  const base = [1, 5, 10, 15, 20, 25].filter((day) => day <= daysInMonth - 3);
  return [...base, daysInMonth].filter((day) => today === null || Math.abs(day - today) > 1);
}

export function layoutMonthLine(line: MonthLineData, options: LayoutOptions = {}): MonthLineLayout {
  const { daysInMonth, today, period } = line;
  const { marks, rows } = layoutMonthMarks(line.marks, daysInMonth, options);
  const todayPct = today === null ? null : dayPercent(today, daysInMonth);
  const fillPct = todayPct ?? (period === "pasado" ? 100 : 0);
  return {
    marks,
    rows,
    extraRows: Math.max(0, rows - BASE_LABEL_ROWS),
    fillPct,
    todayPct,
    ticks: dayTicks(daysInMonth, today).map((day) => ({ day, leftPct: dayPercent(day, daysInMonth) })),
  };
}

/** Date line of the detail window: «Hoy» for today, «16 de noviembre» otherwise. */
export function markDateLabel(day: number, today: number | null, monthName: string): string {
  return day === today ? "Hoy" : `${day} de ${monthName}`;
}
