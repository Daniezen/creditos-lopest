"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Focus handling shared by every overlay of Casa y Negocio: the month line's
 * detail window, the calendar's day window, the «Anotar» panel and the phone's
 * «Más» sheet.
 *
 * WHAT IT DOES while `active`:
 *   1. moves focus into the container (its first focusable element, or the
 *      one `initialFocus` picks) so a keyboard user lands where the content is;
 *   2. keeps Tab and Shift+Tab cycling inside it (the focus trap);
 *   3. calls `onEscape` on Escape — the caller closes and decides where focus
 *      goes back to (usually the control that opened it).
 * When it stops being active, focus returns to `returnFocus` if given and the
 * focus is still inside the container (or lost on <body>): closing never
 * strands a keyboard user at the top of the page, and never steals focus from
 * something the user clicked elsewhere.
 */

/** What can take focus with Tab inside an overlay. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Index the focus moves to when Tab is pressed on element `current` of a
 * trap with `count` elements. Pure, so the wrap-around is unit tested.
 * `current` of -1 means the focus is outside the list (enter at an end).
 */
export function trapIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

/**
 * Open traps, innermost last. Only the top one answers Tab and Escape, so a
 * detail window opened while «Anotar» is open closes first, then the panel.
 */
const stack: object[] = [];

interface FocusTrapOptions {
  active: boolean;
  onEscape: () => void;
  /** Picks the element to focus on activation; the first focusable one by default. */
  initialFocus?: (container: HTMLElement) => HTMLElement | null | undefined;
  /** Where focus goes when the trap ends (if it was still inside). */
  returnFocus?: () => HTMLElement | null | undefined;
}

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, options: FocusTrapOptions): void {
  // Latest callbacks without re-running the effect (which would refocus on every render).
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!options.active) return;
    const container = containerRef.current;
    if (!container) return;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = latest.current.initialFocus?.(container) ?? focusables()[0];
    first?.focus({ preventScroll: true });

    const token = {};
    stack.push(token);

    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      const index = list.indexOf(document.activeElement as HTMLElement);
      const next = trapIndex(list.length, index, event.shiftKey);
      if (next < 0) return;
      event.preventDefault();
      list[next].focus();
    }

    // Capture on the document: Escape works even if focus somehow left the container.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      stack.splice(stack.indexOf(token), 1);
      const active = document.activeElement;
      const lost = !active || active === document.body || container.contains(active);
      if (lost) latest.current.returnFocus?.()?.focus({ preventScroll: true });
    };
  }, [options.active, containerRef]);
}
