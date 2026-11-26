"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";

import { cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { useFocusTrap } from "../shared/focus-trap";
import type { CalendarEventKind, MonthCalendarData } from "../types";
import { calendarCells, calendarDayLabel, neighbourDay, WEEKDAY_NAMES, WEEKDAYS } from "./calendar-grid";

export interface MonthCalendarProps {
  data: MonthCalendarData;
  readOnly: boolean;
  /** Day open on first render (the canvas opens the 20th); none by default. */
  defaultOpenDay?: number | null;
}

/** Ahorro is the square one; everything else is a round dot. */
const SQUARE: Record<CalendarEventKind, boolean> = { cobro: false, casa: false, falta: false, ahorro: true };
const MAX_DOTS = 3;

/**
 * Compact calendar of the month (`Main.dc.html`): Monday-first, up to three
 * dots per day (cobros ink, casa teal, missing red, ahorro gold square),
 * today in violet, past days muted. A day with events is a disclosure button;
 * its ink detail window lists each event with its action, sits under the
 * day's row and is kept inside the card. Opening moves focus into it and Tab
 * stays inside; Escape, ×, the same day or a click outside close it, and
 * focus returns to the day. Arrow keys move between the days that have
 * something, and each day's name says what its dots mean in words.
 */
export function MonthCalendar({ data, readOnly, defaultOpenDay = null }: MonthCalendarProps) {
  const { year, month, today, days, monthName, monthTitle } = data;
  const cells = calendarCells(year, month);
  const [openDay, setOpenDay] = useState<number | null>(defaultOpenDay && days[defaultOpenDay]?.length ? defaultOpenDay : null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef(new Map<number, HTMLButtonElement>());
  const popId = useId();
  const events = openDay ? days[openDay] ?? [] : [];

  // Place the window under the open day, measured from the real cell so it is exact at any width.
  useLayoutEffect(() => {
    if (!openDay) return;
    const cell = dayRefs.current.get(openDay);
    const grid = gridRef.current;
    const pop = popRef.current;
    if (!cell || !grid || !pop) return;
    const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
    const center = cell.offsetLeft + cell.offsetWidth / 2;
    const left = Math.min(Math.max(center - pop.offsetWidth / 2, 0), grid.clientWidth - pop.offsetWidth);
    setPosition({ left: Math.max(left, 0), top: cell.offsetTop + cell.offsetHeight + gap });
  }, [openDay]);

  // Focus moves into the open window, Tab stays in it, Escape closes it and
  // focus returns to its day (`shared/focus-trap.ts`).
  // A window open on first render (the demo's 20th) does not steal focus on load.
  const lastOpenRef = useRef<number | null>(null);
  const [userOpened, setUserOpened] = useState(false);
  useFocusTrap(popRef, {
    active: userOpened && openDay !== null && events.length > 0,
    onEscape: () => setOpenDay(null),
    returnFocus: () => (lastOpenRef.current ? dayRefs.current.get(lastOpenRef.current) : null),
  });

  // A press outside the window and its day closes it, without moving focus.
  useEffect(() => {
    if (!openDay) return;
    const day = openDay;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || dayRefs.current.get(day)?.contains(target)) return;
      setOpenDay(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openDay]);

  // Arrow keys walk the days that have something; Tab still reaches each of them.
  const enabledDays = cells.filter((day): day is number => day !== null && (days[day]?.length ?? 0) > 0);
  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = Number((event.target as HTMLElement).dataset.day);
    if (!current) return;
    const next = neighbourDay(enabledDays, current, event.key);
    if (next === null) return;
    event.preventDefault();
    dayRefs.current.get(next)?.focus();
  }

  const dateLabel = (day: number) => (day === today ? `Hoy, ${day} de ${monthName}` : `${day} de ${monthName}`);

  return (
    <section aria-labelledby="cn-cal" className={[r.card, r.calendar].join(" ")}>
      <div className={r.calendarHead}>
        <h2 id="cn-cal" className={r.sectionTitle}>
          {monthTitle}
        </h2>
        <div aria-hidden="true" className={r.calendarLegend}>
          <span className={[r.legendDot, r.eventDot.cobro].join(" ")} />
          <span className={[r.legendDot, r.eventDot.casa].join(" ")} />
          <span className={[r.legendDot, r.eventDot.falta].join(" ")} />
          <span className={[r.legendSquare, r.eventDot.ahorro].join(" ")} />
        </div>
      </div>

      <div ref={gridRef} className={r.calendarGrid} onKeyDown={onGridKeyDown}>
        {WEEKDAYS.map((letter, index) => (
          <abbr key={WEEKDAY_NAMES[index]} title={WEEKDAY_NAMES[index]} className={`${r.weekday} no-underline`}>
            {letter}
          </abbr>
        ))}

        {cells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
          const dayEvents = days[day] ?? [];
          const isToday = day === today;
          const isPast = today !== null && day < today;
          const expanded = day === openDay;
          const label = calendarDayLabel(
            dateLabel(day),
            dayEvents.map((event) => event.kind),
          );
          return (
            <button
              key={day}
              ref={(element) => {
                if (element) dayRefs.current.set(day, element);
                else dayRefs.current.delete(day);
              }}
              type="button"
              data-day={day}
              disabled={dayEvents.length === 0}
              aria-label={label}
              aria-current={isToday ? "date" : undefined}
              aria-expanded={dayEvents.length ? expanded : undefined}
              aria-controls={expanded ? popId : undefined}
              onClick={() => {
                lastOpenRef.current = day;
                setUserOpened(true);
                setOpenDay(expanded ? null : day);
              }}
              className={[r.cell, isToday ? r.cellToday : isPast ? r.cellPast : ""].join(" ")}
            >
              <span className={[r.cellNumber, isToday ? r.cellNumberToday : ""].join(" ")}>{day}</span>
              <span aria-hidden="true" className={r.cellDots}>
                {dayEvents.slice(0, MAX_DOTS).map((event, dotIndex) => (
                  <span
                    key={dotIndex}
                    className={[
                      SQUARE[event.kind] ? r.cellSquare : r.cellDot,
                      isToday ? r.cellDotOnToday : r.eventDot[event.kind],
                    ].join(" ")}
                  />
                ))}
              </span>
            </button>
          );
        })}

        {openDay && events.length ? (
          <div
            ref={popRef}
            id={popId}
            role="dialog"
            aria-label={dateLabel(openDay)}
            className={r.dayPopover}
            style={position ? { left: position.left, top: position.top } : { visibility: "hidden" }}
          >
            <div className={r.dayPopHead}>
              <span className={r.dayPopDate}>{dateLabel(openDay)}</span>
              <button
                type="button"
                aria-label="Cerrar"
                className={r.dayPopClose}
                onClick={() => setOpenDay(null)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {events.map((event, index) => (
              <div key={index} className={r.dayPopItem}>
                <span aria-hidden="true" className={[SQUARE[event.kind] ? r.dayPopSquare : r.dayPopDot, r.eventDotOnInk[event.kind]].join(" ")} />
                <span className={r.dayPopText}>{event.text}</span>
                {event.action && !readOnly ? (
                  <Link href={event.action.href} className={r.dayPopAction}>
                    {event.action.label}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
