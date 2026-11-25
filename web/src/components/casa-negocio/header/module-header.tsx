"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { cnHeaderRecipes } from "@/design-system/recipes/casa-negocio";

import { Glyph } from "../shared/glyph";
import { useModuleUser } from "../shell/module-user-context";
import { UserAvatar } from "../shell/user-avatar";
import type { MonthLineData } from "../types";
import { FolderTabs } from "./folder-tabs";
import { MonthLine } from "./month-line";
import { QuickEntryPanel, type QuickEntryPanelProps } from "./quick-entry-panel";
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
  quickEntry: Omit<QuickEntryPanelProps, "onClose">;
  /** Phone only (`TableroMovil.dc.html`): the family's money under the month. */
  summary?: { total: string; detail: string };
  /** Query kept when switching tabs (the month being looked at). */
  tabQuery?: string;
}

const PLUS_GLYPH = "M12 5v14M5 12h14";
const LOCK_GLYPH = "M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z";

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
 * floating violet button above the bottom bar.
 */
export function ModuleHeader({ active, month, line, readOnly, quickEntry, summary, tabQuery }: ModuleHeaderProps) {
  const user = useModuleUser();
  const [open, setOpen] = useState(false);
  const focusPanelRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const annotateRef = useRef<HTMLButtonElement>(null);

  // Opening from the floating button scrolls the panel into view and focuses its first choice.
  useEffect(() => {
    if (!open || !focusPanelRef.current) return;
    focusPanelRef.current = false;
    const panel = panelRef.current;
    panel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    panel?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    annotateRef.current?.focus();
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
        ) : (
          <div className={[cnHeaderRecipes.actions, cnHeaderRecipes.desktopOnly].join(" ")}>
            <button
              ref={annotateRef}
              type="button"
              aria-expanded={open}
              aria-controls={open ? "cn-anotar" : undefined}
              onClick={() => (open ? close() : setOpen(true))}
              className={cnHeaderRecipes.annotate}
            >
              <Glyph path={PLUS_GLYPH} className="size-4.25" strokeWidth={2.4} />
              Anotar
            </button>
          </div>
        )}
      </div>

      {open && !readOnly ? <QuickEntryPanel ref={panelRef} {...quickEntry} onClose={close} /> : null}

      <MonthLine line={line} readOnly={readOnly} />
      <FolderTabs active={active} query={tabQuery} />

      {!readOnly ? (
        <button
          type="button"
          aria-label="Anotar movimiento"
          aria-expanded={open}
          aria-controls={open ? "cn-anotar" : undefined}
          onClick={() => {
            if (open) {
              panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              panelRef.current?.querySelector<HTMLElement>("button")?.focus();
              return;
            }
            focusPanelRef.current = true;
            setOpen(true);
          }}
          className={cnHeaderRecipes.fab}
        >
          <span aria-hidden="true">+</span>
        </button>
      ) : null}
    </header>
  );
}
