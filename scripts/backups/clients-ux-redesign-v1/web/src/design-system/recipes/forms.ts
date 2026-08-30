export const formRecipes = {
  label: "mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]",
  labelWithIcon: "mb-1.5 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]",
  control: "w-full rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-focus)] focus:bg-[var(--color-surface-primary)] focus:ring-2 focus:ring-[var(--color-focus-soft)] disabled:cursor-not-allowed disabled:opacity-60",
  error: "text-xs font-medium text-[var(--color-danger)]",
  help: "text-xs text-[var(--color-text-secondary)]",
} as const;
