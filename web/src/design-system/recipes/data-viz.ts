/**
 * Class recipes for the boxes around a chart drawing. The drawing itself is
 * themed by `themes/lopest-chart.ts`; these only size and frame its container.
 *
 * `scrollTrack` + `scrollCanvas` give long monthly series a horizontal scroll
 * instead of squeezing bars: the canvas is at least one category slot per
 * category (`--chart-categories`, set inline by `Chart`) and never narrower
 * than the scroll minimum, both tokens in `tokens/primitives.css`.
 */
export const dataVizRecipes = {
  drawing: "w-full min-w-0",
  heightRegular: "h-[var(--ds-chart-height-regular)]",
  scrollTrack: "flex w-full overflow-x-auto pb-4",
  scrollTrackFromEnd: "flex-row-reverse",
  scrollCanvas:
    "w-full shrink-0 min-w-[max(calc(var(--ds-chart-category-slot)*var(--chart-categories)),var(--ds-chart-scroll-min-width))]",
  emptyState:
    "flex min-h-[var(--ds-chart-height-empty)] items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]",
  emptyStateText: "text-sm text-[var(--color-text-secondary)]",
} as const;
