/**
 * Navigation recipes consuming the semantic design contract.
 *
 * Rules:
 * - No hardcoded Tailwind color primitives (slate, violet, etc.).
 * - Explicit semantic tokens for item states, icons, and section labels.
 */
export const navigationRecipes = {
  item: "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-[var(--font-weight-action)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-soft)]",
  itemIdle: "text-[var(--color-text-secondary)] hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)]",
  itemActive: "bg-[var(--color-selection)] text-[var(--color-selection-strong)] font-[var(--font-weight-heading)]",
  itemIcon: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
  itemIconIdle: "text-[var(--color-text-muted)] group-hover:text-[var(--color-selection-strong)]",
  itemIconActive: "bg-[var(--color-surface-primary)]/80 text-[var(--color-selection-strong)]",
  sectionLabel: "text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]",
  mobileItem: "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[var(--text-2xs)] font-[var(--font-weight-action)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-soft)]",
  mobileItemIdle: "text-[var(--color-text-secondary)] hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)]",
  mobileItemActive: "bg-[var(--color-selection)] text-[var(--color-selection-strong)] font-[var(--font-weight-heading)]",
} as const;
