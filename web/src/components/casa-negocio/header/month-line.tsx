"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

import { cnLineRecipes } from "@/design-system/recipes/casa-negocio";

import type { MonthLineData } from "../types";
import { DEFAULT_TRACK_PX, layoutMonthLine, markDateLabel, percentCss } from "./month-line-layout";

interface MonthLineProps {
  line: MonthLineData;
  /** Hides the actions of the detail window (spec §2: read-only users). */
  readOnly: boolean;
}

/**
 * The month line (`ModuloTabs.dc.html`): elapsed part in ink, HOY in violet
 * exactly on its day, marks by state (done filled, to come hollow, unpaid with
 * a red ring, the close in gold at the end), labels that never overlap
 * (`month-line-layout.ts`), and a small detail window with an action when a
 * mark is touched. Nothing counts down.
 *
 * Each mark is a disclosure button (`aria-expanded` + `aria-controls`) for its
 * detail window; Escape, the window's ×, the same mark or a click outside
 * close it, and focus returns to the mark.
 */
export function MonthLine({ line, readOnly }: MonthLineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef(new Map<string, HTMLButtonElement>());
  const [trackWidth, setTrackWidth] = useState(DEFAULT_TRACK_PX);
  const [openId, setOpenId] = useState<string | null>(null);
  const popId = useId();

  // Labels are laid out on the measured track width, so they never overlap at any size.
  useEffect(() => {
    const element = trackRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setTrackWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => layoutMonthLine(line, { trackWidthPx: trackWidth }), [line, trackWidth]);
  const open = layout.marks.find((mark) => mark.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    const markId = openId;
    function close() {
      setOpenId(null);
      markRefs.current.get(markId)?.focus();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || markRefs.current.get(markId)?.contains(target)) return;
      setOpenId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openId]);

  const trackStyle = { "--cn-line-extra-rows": layout.extraRows } as CSSProperties;

  return (
    <div className={cnLineRecipes.wrap}>
      <div ref={trackRef} role="group" aria-label={line.summary} className={cnLineRecipes.track} style={trackStyle}>
        <div className={cnLineRecipes.rail} aria-hidden="true" />
        <div className={cnLineRecipes.fill} style={{ width: percentCss(layout.fillPct) }} aria-hidden="true" />

        {layout.ticks.map((tick) => (
          <span key={tick.day} aria-hidden="true" className={cnLineRecipes.tick} style={{ left: percentCss(tick.leftPct) }}>
            {tick.day}
          </span>
        ))}

        {layout.todayPct !== null ? (
          <div className={cnLineRecipes.hoy} style={{ left: percentCss(layout.todayPct) }}>
            <span className={cnLineRecipes.hoyLabel}>HOY</span>
            <span className={cnLineRecipes.hoyBar} aria-hidden="true" />
          </div>
        ) : null}

        {layout.marks.map((mark) => {
          const expanded = mark.id === openId;
          const style = {
            left: percentCss(mark.leftPct),
            "--cn-mark-nudge": mark.nudge,
            "--cn-mark-row": mark.row,
          } as CSSProperties;
          return (
            <button
              key={mark.id}
              ref={(element) => {
                if (element) markRefs.current.set(mark.id, element);
                else markRefs.current.delete(mark.id);
              }}
              type="button"
              aria-label={`${mark.title}, ${markDateLabel(mark.day, line.today, line.monthName)}`}
              aria-expanded={expanded}
              aria-controls={expanded ? popId : undefined}
              onClick={() => setOpenId(expanded ? null : mark.id)}
              className={cnLineRecipes.mark}
              style={style}
            >
              <span aria-hidden="true" className={cnLineRecipes.dot[mark.kind]} />
              <span aria-hidden="true" className={[cnLineRecipes.markLabel, cnLineRecipes.labelTone[mark.kind]].join(" ")}>
                {mark.label}
              </span>
            </button>
          );
        })}

        {open ? (
          <div
            ref={popRef}
            id={popId}
            role="dialog"
            aria-label={open.title}
            className={cnLineRecipes.popover}
            style={{ "--cn-pop-left": percentCss(open.leftPct) } as CSSProperties}
          >
            <div className={cnLineRecipes.popHead}>
              <span className={cnLineRecipes.popDate}>{markDateLabel(open.day, line.today, line.monthName)}</span>
              <button
                type="button"
                aria-label="Cerrar"
                className={cnLineRecipes.popClose}
                onClick={() => {
                  setOpenId(null);
                  markRefs.current.get(open.id)?.focus();
                }}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className={cnLineRecipes.popTitle}>{open.title}</div>
            <div className={cnLineRecipes.popDetail}>{open.detail}</div>
            {open.action && !readOnly ? (
              <Link href={open.action.href} className={cnLineRecipes.popAction}>
                {open.action.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
