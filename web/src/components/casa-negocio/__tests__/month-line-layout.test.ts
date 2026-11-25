import { describe, expect, it } from "vitest";

import { demoHeader } from "../fixtures/canvas-noviembre";
import {
  dayPercent,
  dayTicks,
  LABEL_CHAR_PX,
  LABEL_GAP_PX,
  layoutMonthLine,
  layoutMonthMarks,
  markDateLabel,
  NUDGE_PX,
} from "../header/month-line-layout";
import type { MonthLineData, MonthMark } from "../types";

const canvasLine = demoHeader("tablero").line;

const mark = (id: string, day: number, label = id, kind: MonthMark["kind"] = "pagado"): MonthMark => ({
  id,
  day,
  kind,
  label,
  title: id,
  detail: "",
});

/** Pixel interval of each label, exactly as the layout reasons about it. */
function labelBoxes(line: MonthLineData, trackWidthPx: number) {
  const { marks } = layoutMonthMarks(line.marks, line.daysInMonth, { trackWidthPx });
  return marks.map((m) => {
    const center = (m.leftPct / 100) * trackWidthPx + m.nudge * NUDGE_PX;
    const half = (m.label.length * LABEL_CHAR_PX) / 2;
    return { id: m.id, row: m.row, start: center - half, end: center + half };
  });
}

describe("dayPercent", () => {
  it("puts each day at the centre of its slot", () => {
    expect(dayPercent(1, 30)).toBeCloseTo(1.667, 3);
    expect(dayPercent(25, 30)).toBeCloseTo(81.667, 3);
    expect(dayPercent(30, 30)).toBeCloseTo(98.333, 3);
  });

  it("clamps days outside the month", () => {
    expect(dayPercent(0, 30)).toBe(dayPercent(1, 30));
    expect(dayPercent(31, 30)).toBe(dayPercent(30, 30));
  });
});

describe("layoutMonthLine", () => {
  it("draws HOY exactly where a mark of the same day sits, and fills up to it", () => {
    const layout = layoutMonthLine(canvasLine);
    const todayMark = layout.marks.find((m) => m.id === "cobros-25");
    expect(layout.todayPct).toBe(todayMark?.leftPct);
    expect(layout.fillPct).toBe(layout.todayPct);
  });

  it("moves the close to the last day and draws it last, whatever day it came with", () => {
    const line: MonthLineData = {
      ...canvasLine,
      daysInMonth: 31,
      marks: [mark("cierre", 3, "Cierre", "cierre"), mark("a", 31), mark("b", 10)],
    };
    const { marks } = layoutMonthLine(line);
    expect(marks.at(-1)).toMatchObject({ id: "cierre", day: 31, leftPct: dayPercent(31, 31) });
    expect(marks.map((m) => m.id)).toEqual(["b", "a", "cierre"]);
  });

  it("fills a closed month entirely and a future one not at all, without HOY", () => {
    expect(layoutMonthLine({ ...canvasLine, today: null, period: "pasado" })).toMatchObject({ fillPct: 100, todayPct: null });
    expect(layoutMonthLine({ ...canvasLine, today: null, period: "futuro" })).toMatchObject({ fillPct: 0, todayPct: null });
  });

  it("grows the line only when labels need more rows than the base height holds", () => {
    expect(layoutMonthLine(canvasLine, { trackWidthPx: 1200 }).extraRows).toBe(0);
    const crowded = { ...canvasLine, marks: Array.from({ length: 6 }, (_, i) => mark(`m${i}`, 10, "Etiqueta larga")) };
    const layout = layoutMonthLine(crowded, { trackWidthPx: 1200 });
    expect(layout.rows).toBe(6);
    expect(layout.extraRows).toBe(3);
  });
});

describe("labels never overlap", () => {
  it.each([360, 640, 900, 1200, 1400])("on the canvas month at %ipx", (width) => {
    const boxes = labelBoxes(canvasLine, width);
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b || a.row !== b.row) continue;
        const apart = a.end + LABEL_GAP_PX <= b.start || b.end + LABEL_GAP_PX <= a.start;
        expect(apart, `${a.id} and ${b.id} share row ${a.row}`).toBe(true);
      }
    }
  });

  it("keeps far-apart labels on the first row", () => {
    const { marks } = layoutMonthMarks([mark("a", 2, "Uno"), mark("b", 15, "Dos"), mark("c", 28, "Tres")], 30);
    expect(marks.map((m) => m.row)).toEqual([0, 0, 0]);
  });

  it("drops the second of two same-day marks a row and nudges its dot", () => {
    const { marks } = layoutMonthMarks([mark("davivienda", 16, "Davivienda"), mark("funeraria", 16, "Funeraria")], 30);
    expect(marks[0]).toMatchObject({ nudge: 0, row: 0 });
    expect(marks[1]).toMatchObject({ nudge: 1, row: 1 });
    expect(marks[0].leftPct).toBe(marks[1].leftPct);
  });
});

describe("dayTicks", () => {
  it("numbers the canvas days and ends on the last day", () => {
    expect(dayTicks(30, null)).toEqual([1, 5, 10, 15, 20, 25, 30]);
    expect(dayTicks(28, null)).toEqual([1, 5, 10, 15, 20, 25, 28]);
    expect(dayTicks(31, null)).toEqual([1, 5, 10, 15, 20, 25, 31]);
  });

  it("leaves HOY's spot free", () => {
    expect(dayTicks(30, 25)).toEqual([1, 5, 10, 15, 20, 30]);
    expect(dayTicks(30, 26)).toEqual([1, 5, 10, 15, 20, 30]);
  });
});

describe("markDateLabel", () => {
  it("says Hoy for today and the date otherwise", () => {
    expect(markDateLabel(25, 25, "noviembre")).toBe("Hoy");
    expect(markDateLabel(16, 25, "noviembre")).toBe("16 de noviembre");
  });
});
