export const surfaceRecipes = {
  section: "rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] shadow-[var(--ds-shadow-surface)]",
  sectionSpacious: "rounded-[2rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/90 p-4 shadow-[var(--ds-shadow-surface)] backdrop-blur",
  sectionCompact: "rounded-[1.75rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/90 p-4 shadow-[var(--ds-shadow-surface)] backdrop-blur",
  dataPanel: "overflow-hidden rounded-[2rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] shadow-[var(--ds-shadow-panel)]",
  stickyDataPanel: "rounded-[2rem] border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] shadow-[var(--ds-shadow-panel)]",
  dataPanelHeader: "flex flex-col justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-5 sm:flex-row sm:items-center",
  compact: "rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]",
  overlay: "rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] shadow-[var(--ds-shadow-overlay)]",
  filterTray: "rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-3",
  filterOverlayPanel: "border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] shadow-[var(--ds-shadow-overlay)]",
} as const;
