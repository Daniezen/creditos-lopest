/**
 * Class recipes of the Casa y Negocio visual language (approved canvas,
 * docs/design-system/lienzo-casa-negocio/). Every value is a `--cn-*` role
 * (tokens/semantic.css), a typography role (tokens/typography.css), a
 * geometry token (tokens/primitives.css) or a step of Tailwind's spacing
 * scale; no view of the module writes a color, size or radius of its own.
 *
 * Scope: only /casa-negocio consumes these until the rest of the app is
 * redesigned view by view. The existing recipes are untouched.
 *
 * Organisation mirrors the canvas artboards: shell (Sidebar), header
 * (ModuloTabs), line (the month line inside it), tabs, tablero (Main),
 * notice, and mobile (TableroMovil).
 */

/**
 * Visible focus for every interactive element of the module. An outline,
 * not a box-shadow, because several pieces already use box-shadow as their
 * state ring (envelopes, calendar cells, month marks).
 */
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cn-color-focus)]";

/** Typography roles: display light titles, tabular light figures, eyebrows. */
export const cnTypeRecipes = {
  eyebrow:
    "text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-eyebrow)] uppercase tracking-[var(--tracking-eyebrow)]",
  display:
    "m-0 text-[length:var(--text-cn-display)] font-[var(--font-weight-display)] leading-[var(--leading-display)] tracking-[var(--tracking-display)]",
  section: "m-0 text-[length:var(--text-cn-section)] font-[var(--font-weight-display)]",
  figure: "font-[var(--font-weight-figure)] tabular-nums",
  figureHero: "text-[length:var(--text-cn-figure-hero)] font-[var(--font-weight-figure)] tabular-nums",
  figureXl: "text-[length:var(--text-cn-figure-xl)] font-[var(--font-weight-figure)] tabular-nums",
  figureLg: "text-[length:var(--text-cn-figure-lg)] font-[var(--font-weight-figure)] tabular-nums",
  figureMd: "text-[length:var(--text-cn-section)] font-[var(--font-weight-figure)] tabular-nums",
  figureSm: "text-[length:var(--text-cn-figure-sm)] font-[var(--font-weight-figure)] tabular-nums",
  figureXsMedium: "text-[length:var(--text-cn-figure-xs)] font-[var(--font-weight-medium)] tabular-nums",
  srOnly: "sr-only",
  focus,
} as const;

/** Module shell: lienzo ground, dark folded rail, content column. */
export const cnShellRecipes = {
  root: "flex min-h-screen w-full items-stretch bg-[var(--cn-color-lienzo)] font-[family-name:var(--font-product-sans)] text-[var(--cn-color-text)] max-md:bg-[var(--cn-color-paper)]",
  main: "min-w-0 flex-1 px-7 pb-10 pt-5 max-md:px-0 max-md:pb-[var(--ds-cn-bottom-nav-reserve)] max-md:pt-0",
  column: "mx-auto w-full max-w-[var(--ds-cn-content-max)]",

  rail: "sticky top-0 hidden h-screen w-[var(--ds-cn-rail-width)] flex-none flex-col items-center gap-1.5 overflow-y-auto bg-[var(--cn-color-ink)] px-2.5 py-4.5 md:flex",
  railBrand: `mb-4.5 inline-flex size-11 flex-none items-center justify-center rounded-[var(--ds-radius-tab)] bg-[image:var(--cn-brand-mark)] text-xl font-[var(--font-weight-bold)] text-[var(--cn-color-on-ink)] no-underline ${focus}`,
  railItem: `flex w-[var(--ds-cn-rail-item)] flex-none flex-col items-center gap-1.25 rounded-[var(--ds-radius-tab)] border-0 bg-transparent py-2 text-[var(--cn-color-on-ink-soft)] no-underline transition-colors duration-[var(--ds-duration-fast)] hover:text-[var(--cn-color-on-ink)] aria-[current=page]:text-[var(--cn-color-on-ink)] cursor-pointer disabled:cursor-wait ${focus}`,
  railIcon:
    "inline-flex h-[var(--ds-cn-rail-icon-h)] w-[var(--ds-cn-rail-icon-w)] items-center justify-center rounded-[var(--ds-radius-icon)]",
  railIconActive: "bg-[var(--cn-color-action)]",
  railLabel:
    "text-center text-[length:var(--text-2xs)] font-[var(--font-weight-medium)] leading-[var(--leading-label)]",
  railFooter: "mt-auto flex flex-col items-center gap-2.5 pt-4",
  avatar:
    "inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-[var(--cn-color-ink-raised)] text-sm font-[var(--font-weight-semibold)] text-[var(--cn-color-on-ink)] ring-2 ring-[var(--cn-color-action-ring)]",
  avatarSm:
    "inline-flex size-8.5 items-center justify-center overflow-hidden rounded-full bg-[var(--cn-color-ink-raised)] text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-semibold)] text-[var(--cn-color-on-ink)] ring-2 ring-[var(--cn-color-action-ring)]",
  avatarImage: "size-full object-cover",
  version: `rounded-[var(--ds-radius-sm)] px-1 text-[length:var(--text-3xs)] text-[var(--cn-color-text-faint)] no-underline hover:text-[var(--cn-color-on-ink)] ${focus}`,
} as const;

/** Mobile: dark bottom navigation and its «Más» sheet. */
export const cnMobileNavRecipes = {
  bar: "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 bg-[var(--cn-color-ink)] px-1.5 pb-[max(calc(var(--spacing)*4.5),env(safe-area-inset-bottom))] pt-2 md:hidden",
  item: `flex min-h-13 flex-col items-center justify-center gap-1 border-0 bg-transparent text-[length:var(--text-2xs)] font-[var(--font-weight-medium)] text-[var(--cn-color-on-ink-soft)] no-underline aria-[current=page]:text-[var(--cn-color-on-ink)] cursor-pointer ${focus}`,
  icon: "inline-flex h-6.5 w-9 items-center justify-center rounded-[var(--ds-radius-icon)]",
  iconActive: "bg-[var(--cn-color-action)]",
  backdrop: "fixed inset-0 z-30 border-0 bg-[var(--color-overlay-backdrop)] md:hidden",
  sheet:
    "fixed inset-x-0 bottom-[calc(var(--ds-cn-bottom-nav-height)+env(safe-area-inset-bottom))] z-40 flex flex-col gap-1 rounded-t-[var(--ds-radius-xl)] bg-[var(--cn-color-ink)] px-4 pb-3 pt-4 md:hidden",
  sheetItem: `flex min-h-12 w-full items-center gap-3 rounded-[var(--ds-radius-md)] border-0 bg-transparent px-2 text-sm font-[var(--font-weight-medium)] text-[var(--cn-color-on-ink-soft)] no-underline hover:text-[var(--cn-color-on-ink)] aria-[current=page]:text-[var(--cn-color-on-ink)] cursor-pointer ${focus}`,
  sheetVersion: "px-2 pt-1 text-[length:var(--text-3xs)] text-[var(--cn-color-text-faint)]",
} as const;
