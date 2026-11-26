"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { cnHeaderRecipes } from "@/design-system/recipes/casa-negocio";

import { useFocusTrap } from "../shared/focus-trap";
import { Glyph } from "../shared/glyph";
import { useModuleUser } from "../shell/module-user-context";
import { UserAvatar } from "../shell/user-avatar";
import type { MonthLineData } from "../types";
import { FolderTabs } from "./folder-tabs";
import { MonthLine } from "./month-line";
import { prefillFromParams, type QuickEntryPrefill } from "./quick-entry";
import { QuickEntryPanel, type QuickEntryConfig } from "./quick-entry-panel";
import type { CasaNegocioTab } from "./tabs";

export interface ModuleHeaderMonth {
  /** «Noviembre». */
  title: string;
  /** «2026», drawn faint after the month. */
  year: string;
  /** Neighbour months; null disables the arrow (e.g. before the module's start). */
  prevHref: string | null;
  nextHref: string | null;
}

export interface ModuleHeaderProps {
  active: CasaNegocioTab;
  month: ModuleHeaderMonth;
  line: MonthLineData;
  /** Without `casa_negocio.anotar`: no «Anotar», a «Solo lectura» chip, no actions in details. */
  readOnly: boolean;
  /**
   * «Anotar». Null hides the button without the read-only chip: the person may
   * write but there is nowhere to write yet (no accounts configured).
   */
  quickEntry: QuickEntryConfig | null;
  /** Phone only (`TableroMovil.dc.html`): the family's money under the month. */
  summary?: { total: string; detail: string };
  /** Query kept when switching tabs (the month being looked at). */
  tabQuery?: string;
}

const PLUS_GLYPH = "M12 5v14M5 12h14";
/** The canvas' padlock: a rounded body (rect 5,11 14×10 r2) and its shackle. */
const LOCK_GLYPH = "M8 11V7a4 4 0 0 1 8 0v4M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z";

function MonthArrow({ href, label, glyph }: { href: string | null; label: string; glyph: string }) {
  if (!href) {
    return (
      <span role="link" aria-disabled="true" aria-label={label} className={cnHeaderRecipes.monthNav}>
        <span aria-hidden="true">{glyph}</span>
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cnHeaderRecipes.monthNav}>
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}

/**
 * Common header of every Casa y Negocio tab (`ModuloTabs.dc.html`): eyebrow,
 * the month as a light display title with its arrows, «Anotar» (or «Solo
 * lectura»), the quick entry panel, the month line and the folder tabs.
 * Everything arrives by props; nothing is queried here.
 *
 * On phones the same header becomes the ink block of `TableroMovil.dc.html`
 * (avatar, month, optional summary, compact line) and «Anotar» moves to the
 * floating violet button above the bottom bar; the panel then opens as a
 * bottom sheet over a backdrop.
 *
 * KEYBOARD. Opening moves focus to the panel's first choice and Tab stays in
 * it; Escape or «Cerrar» close it and focus returns to what opened it. A
 * successful save is announced in a polite live region.
 */
export function ModuleHeader({ active, month, line, readOnly, quickEntry, summary, tabQuery }: ModuleHeaderProps) {
  const user = useModuleUser();
  // A prefilled header («Pagar» in a detail window) arrives with the panel open.
  const [prefill, setPrefill] = useState<QuickEntryPrefill | null>(quickEntry?.prefill ?? null);
  const [panelKey, setPanelKey] = useState(0);
  const [open, setOpen] = useState(prefill !== null);
  const panelRef = useRef<HTMLElement>(null);
  const annotateRef = useRef<HTMLButtonElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  // The control that opened the panel gets focus back when it closes.
  const openerRef = useRef<HTMLElement | null>(null);
  // Result of the last save, read once by assistive technology (aria-live).
  const [announcement, setAnnouncement] = useState("");

  // On phones the panel is a bottom sheet: the page behind it does not scroll.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 47.999rem)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Opening scrolls the panel into view (it may be far above on a long tab).
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const canAnnotate = !readOnly && quickEntry !== null;

  // «Pagar» links (`?anotar=…`, in the line, the calendar or the phone's next
  // action) open the panel right here instead of navigating: same page, same
  // data, and it works again after the panel was closed.
  useEffect(() => {
    if (!canAnnotate) return;
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      const next = prefillFromParams((name) => url.searchParams.get(name));
      if (!next) return;
      event.preventDefault();
      openerRef.current = link;
      setPrefill(next);
      setPanelKey((key) => key + 1);
      setOpen(true);
    }
    // Capture phase: runs before the <Link> handler, which then sees
    // `defaultPrevented` and does not navigate.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [canAnnotate]);

  const cleanHref = quickEntry?.cleanHref;
  const hadPrefillParam = useRef(quickEntry?.prefill != null);
  const close = useCallback(() => {
    setOpen(false);
    setPrefill(null);
    // Drop `?anotar=…` from an arrival URL so a reload does not reopen it.
    // Next.js syncs native history calls with its router: no refetch happens.
    if (hadPrefillParam.current && cleanHref) {
      hadPrefillParam.current = false;
      window.history.replaceState(null, "", cleanHref);
    }
  }, [cleanHref]);
  // The action already revalidated the module's data; closing and saying so is what is left.
  const saved = useCallback(() => {
    setAnnouncement("Movimiento guardado.");
    close();
  }, [close]);

  // Focus into the panel, Tab kept inside, Escape closes (`shared/focus-trap.ts`).
  // Focus goes back to whoever opened it: «Anotar», the floating button or a
  // «Pagar» link; when that link is gone (its window closed), to «Anotar».
  useFocusTrap(panelRef, {
    active: open && canAnnotate,
    onEscape: close,
    returnFocus: () => {
      const opener = openerRef.current;
      if (opener?.isConnected && opener.offsetParent !== null) return opener;
      return annotateRef.current?.offsetParent ? annotateRef.current : fabRef.current;
    },
  });

  function openFrom(opener: HTMLElement) {
    openerRef.current = opener;
    setAnnouncement("");
    setOpen(true);
  }

  return (
    <header className={cnHeaderRecipes.root}>
      <div className={cnHeaderRecipes.top}>
        <div className={cnHeaderRecipes.titleBlock}>
          <div className={cnHeaderRecipes.eyebrowRow}>
            <div className={cnHeaderRecipes.eyebrow}>Casa y Negocio</div>
            {user ? (
              <span className={cnHeaderRecipes.mobileOnly}>
                <UserAvatar user={user} size="small" />
              </span>
            ) : null}
          </div>
          <div className={cnHeaderRecipes.titleRow}>
            <h1 className={cnHeaderRecipes.title}>
              {month.title} <span className={cnHeaderRecipes.titleYear}>{month.year}</span>
            </h1>
            <MonthArrow href={month.prevHref} label="Mes anterior" glyph="‹" />
            <MonthArrow href={month.nextHref} label="Mes siguiente" glyph="›" />
          </div>
          {summary ? (
            <div className={cnHeaderRecipes.summary}>
              <div className={cnHeaderRecipes.summaryTotal}>{summary.total}</div>
              <div className={cnHeaderRecipes.summaryDetail}>{summary.detail}</div>
            </div>
          ) : null}
        </div>

        {readOnly ? (
          <div className={cnHeaderRecipes.readOnly}>
            <Glyph path={LOCK_GLYPH} className="size-3.75" strokeWidth={2.2} />
            Solo lectura
          </div>
        ) : canAnnotate ? (
          <div className={[cnHeaderRecipes.actions, cnHeaderRecipes.desktopOnly].join(" ")}>
            <button
              ref={annotateRef}
              type="button"
              aria-expanded={open}
              aria-controls={open ? "cn-anotar" : undefined}
              onClick={(event) => (open ? close() : openFrom(event.currentTarget))}
              className={cnHeaderRecipes.annotate}
            >
              <Glyph path={PLUS_GLYPH} className="size-4.25" strokeWidth={2.4} />
              Anotar
            </button>
          </div>
        ) : null}
      </div>

      {open && canAnnotate ? (
        <>
          <button type="button" tabIndex={-1} aria-label="Cerrar Anotar" className={cnHeaderRecipes.sheetBackdrop} onClick={close} />
          <QuickEntryPanel key={panelKey} ref={panelRef} {...quickEntry!} prefill={prefill} onClose={close} onSaved={saved} />
        </>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <MonthLine line={line} readOnly={readOnly} />
      <FolderTabs active={active} query={tabQuery} />

      {canAnnotate ? (
        <button
          type="button"
          aria-label="Anotar movimiento"
          aria-expanded={open}
          aria-controls={open ? "cn-anotar" : undefined}
          ref={fabRef}
          onClick={(event) => (open ? panelRef.current?.querySelector<HTMLElement>("button")?.focus() : openFrom(event.currentTarget))}
          className={cnHeaderRecipes.fab}
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}
    </header>
  );
}
