/**
 * Version history surfaces: the footer link in the navigation and the
 * `/novedades` timeline (`docs/specs/versiones.md` §4).
 *
 * The timeline does not reuse a data table: a version has no columns, only a
 * date and grouped bullets, so it reads as a stack of cards, newest first,
 * identical at every width. The dot in each header marks its state: filled
 * with the action color for the current version, hollow for unreleased.
 */
export const versionRecipes = {
  footerLink:
    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-[var(--font-weight-label)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-focus-soft)]",
  footerLinkActive: "bg-[var(--color-selection)] text-[var(--color-selection-strong)]",
  footerVersion: "tabular-nums",
  timeline: "flex flex-col gap-4",
  node: "p-5 sm:p-6",
  // Base shape only; exactly one of the three state classes adds the color.
  nodeDot: "h-2.5 w-2.5 shrink-0 rounded-full border-2",
  nodeDotReleased: "border-transparent bg-[var(--color-border-default)]",
  nodeDotCurrent: "border-transparent bg-[var(--color-action-primary)]",
  nodeDotUnreleased: "border-[var(--color-border-default)] bg-[var(--color-surface-primary)]",
  nodeHeader: "flex flex-wrap items-center gap-x-3 gap-y-1",
  nodeTitle: "text-lg font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)] tabular-nums",
  nodeDate: "text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]",
  sectionList: "mt-4 flex flex-col gap-4",
  sectionTitle: "text-xs font-[var(--font-weight-label)] uppercase tracking-wide text-[var(--color-text-secondary)]",
  bulletList: "mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm font-[var(--font-weight-body)] leading-relaxed text-[var(--color-text-primary)]",
  inlineCode:
    "rounded-md bg-[var(--color-surface-subtle)] px-1 py-0.5 font-mono text-xs text-[var(--color-text-primary)]",
  inlineStrong: "font-[var(--font-weight-heading)]",
} as const;
