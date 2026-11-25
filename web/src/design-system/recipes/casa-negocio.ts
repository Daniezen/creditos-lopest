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

/**
 * Module header (`ModuloTabs.dc.html`): white folder top on desktop; on
 * phones an ink block (`TableroMovil.dc.html`) whose active tab is paper.
 */
export const cnHeaderRecipes = {
  root: "w-full rounded-t-[var(--ds-radius-xl)] border border-b-0 border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-8 pt-6.5 text-[var(--cn-color-text)] max-md:rounded-none max-md:border-0 max-md:bg-[var(--cn-color-ink)] max-md:px-5 max-md:pt-5 max-md:text-[var(--cn-color-on-ink)]",
  top: "flex flex-wrap items-start justify-between gap-x-7 gap-y-5",
  titleBlock: "min-w-0 max-md:w-full",
  eyebrowRow: "flex items-center justify-between gap-3",
  eyebrow: `${cnTypeRecipes.eyebrow} text-[var(--cn-color-text-secondary)] max-md:text-[length:var(--text-xs)] max-md:text-[var(--cn-color-on-ink-soft)]`,
  mobileOnly: "md:hidden",
  desktopOnly: "max-md:hidden",
  titleRow: "mt-1 flex items-center gap-2.5 max-md:mt-2.5",
  title: `${cnTypeRecipes.display} max-md:text-[length:var(--text-cn-display-sm)]`,
  titleYear: "text-[var(--cn-color-text-faint)] max-md:text-[var(--cn-color-on-ink-soft)]",
  monthNav: `inline-flex size-9 flex-none items-center justify-center rounded-full border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] text-base text-[var(--cn-color-text)] no-underline cursor-pointer max-md:border-[var(--cn-color-ink-raised)] max-md:bg-transparent max-md:text-[var(--cn-color-on-ink)] aria-disabled:cursor-default aria-disabled:opacity-40 ${focus}`,
  actions: "flex flex-wrap items-center gap-2",
  annotate: `inline-flex min-h-11 items-center gap-2 rounded-[var(--ds-radius-md)] border-0 bg-[var(--cn-color-action)] px-5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-on-ink)] cursor-pointer transition-colors duration-[var(--ds-duration-fast)] hover:bg-[var(--cn-color-action-hover)] ${focus}`,
  readOnly:
    "inline-flex min-h-9 items-center gap-2 rounded-full bg-[var(--cn-color-track)] px-3.5 text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-semibold)] text-[var(--cn-color-text)]",
  summary: "mt-3.5 md:hidden",
  summaryTotal: cnTypeRecipes.figureHero,
  summaryDetail: "text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-on-ink-soft)]",
  fab: `fixed bottom-24 right-4.5 z-30 inline-flex size-[var(--ds-cn-fab)] items-center justify-center rounded-[var(--ds-radius-card)] border-0 bg-[var(--cn-color-action)] text-[length:var(--text-cn-figure-lg)] font-[var(--font-weight-light)] text-[var(--cn-color-on-ink)] shadow-[var(--cn-shadow-overlay)] cursor-pointer md:hidden ${focus}`,
} as const;

/** Quick entry panel opened by «Anotar». */
export const cnQuickEntryRecipes = {
  panel: "mt-4 flex flex-col gap-3.5 rounded-[var(--ds-radius-panel)] bg-[var(--cn-color-paper)] px-5 py-4.5 text-[var(--cn-color-text)] shadow-[var(--cn-shadow-panel-active)]",
  kinds: "flex flex-wrap gap-2",
  kind: `inline-flex min-h-10 items-center gap-2 rounded-full border-0 bg-[var(--cn-color-surface)] px-3.5 text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] cursor-pointer aria-pressed:bg-[var(--cn-color-ink)] aria-pressed:text-[var(--cn-color-on-ink)] ${focus}`,
  kindDot: "size-2 flex-none rounded-[var(--ds-radius-chip)]",
  fields: "grid grid-cols-[repeat(auto-fit,minmax(var(--ds-cn-field-min),1fr))] gap-3",
  field: "flex flex-col gap-1 text-xs text-[var(--cn-color-text-secondary)]",
  control: `min-h-11.5 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-input)] font-[var(--font-weight-regular)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] ${focus}`,
  amount: `min-h-11.5 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-figure-sm)] font-[var(--font-weight-light)] leading-[var(--leading-tight)] tabular-nums text-[var(--cn-color-text)] ${focus}`,
  footer: "flex justify-end gap-2",
  close: `min-h-11 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-4.5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] cursor-pointer ${focus}`,
  save: `min-h-11 rounded-[var(--ds-radius-md)] border-0 bg-[var(--cn-color-action)] px-6 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-on-ink)] cursor-pointer hover:bg-[var(--cn-color-action-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
} as const;

/** Identity dots of the quick entry kinds and the folder tabs. */
export const cnIdentityRecipes = {
  dotNegocio: "bg-[var(--cn-color-negocio)]",
  dotCasa: "bg-[var(--cn-color-casa)]",
  dotAhorro: "bg-[var(--cn-color-ahorro)]",
  dotNeutral: "bg-[var(--cn-color-text-faint)]",
  textNegocio: "text-[var(--cn-color-negocio-label)]",
  textCasa: "text-[var(--cn-color-casa)]",
  textAhorro: "text-[var(--cn-color-ahorro-text)]",
} as const;

/**
 * Month line. Desktop: light track with labels; phones: the compact line of
 * `TableroMovil.dc.html` on ink, marks only, details still one tap away.
 */
export const cnLineRecipes = {
  wrap: "relative z-[2] mt-4.5 max-md:mt-4.5",
  track:
    "relative mx-[var(--ds-cn-line-inset)] h-[calc(var(--ds-cn-line-height)+var(--cn-line-extra-rows,0)*var(--ds-cn-line-row))] max-md:mx-1.5 max-md:h-6.5",
  rail: "absolute inset-x-0 top-7.5 h-1 rounded-full bg-[var(--cn-color-track)] max-md:top-2.75 max-md:bg-[var(--cn-color-ink-raised)]",
  fill: "absolute left-0 top-7.5 h-1 rounded-full bg-[var(--cn-color-ink)] max-md:top-2.75 max-md:bg-[var(--cn-color-on-ink)]",
  hoy: "pointer-events-none absolute top-2 flex -translate-x-1/2 flex-col items-center max-md:top-0",
  hoyLabel:
    "text-[length:var(--text-2xs)] font-[var(--font-weight-bold)] leading-[var(--leading-tight)] text-[var(--cn-color-action)] max-md:sr-only",
  hoyBar:
    "h-[var(--ds-cn-line-hoy)] w-0.5 rounded-sm bg-[var(--cn-color-action)] max-md:h-6.5 max-md:bg-[var(--cn-color-action-on-ink)]",
  tick: "pointer-events-none absolute top-0 -translate-x-1/2 text-[length:var(--text-2xs)] leading-[var(--leading-tight)] text-[var(--cn-color-text-faint)] max-md:hidden",
  mark: `absolute top-5.5 flex translate-x-[calc(-50%+var(--cn-mark-nudge,0)*var(--ds-cn-line-nudge))] flex-col items-center gap-0.75 rounded-[var(--ds-radius-sm)] border-0 bg-transparent px-1 py-0.75 cursor-pointer aria-expanded:bg-[var(--cn-color-selected)] max-md:top-0.75 max-md:aria-expanded:bg-[var(--cn-color-ink-raised)] ${focus}`,
  markLabel:
    "mt-[calc(var(--cn-mark-row,0)*var(--ds-cn-line-row))] whitespace-nowrap text-[length:var(--text-2xs)] font-[var(--font-weight-medium)] leading-[var(--leading-tight)] max-md:hidden",
  /** Dot per kind: size, shape, fill and ring, light ground then ink ground. */
  dot: {
    pagado:
      "size-[var(--ds-cn-mark)] rounded-full bg-[var(--cn-color-ink)] shadow-[var(--cn-mark-halo)] max-md:bg-[var(--cn-color-on-ink)] max-md:shadow-[var(--cn-mark-ring-on-ink)]",
    vencido:
      "size-[var(--ds-cn-mark)] rounded-full bg-[var(--cn-color-problem-tint)] shadow-[var(--cn-mark-ring-problem)] max-md:bg-[var(--cn-color-problem-soft)] max-md:shadow-[var(--cn-mark-ring-on-ink-problem)]",
    entrada:
      "size-[var(--ds-cn-mark-sm)] rounded-[var(--ds-radius-chip)] bg-[var(--cn-color-casa)] shadow-[var(--cn-mark-halo)] max-md:size-[var(--ds-cn-mark)] max-md:shadow-[var(--cn-mark-ring-on-ink)]",
    viene:
      "size-[var(--ds-cn-mark-sm)] rounded-full bg-[var(--cn-color-surface)] shadow-[var(--cn-mark-ring-ink)] max-md:bg-[var(--cn-color-ink)] max-md:shadow-[var(--cn-mark-ring-on-ink-light)]",
    cierre:
      "size-[var(--ds-cn-mark-md)] rounded-[var(--ds-radius-chip)] bg-[var(--cn-color-surface)] shadow-[var(--cn-mark-ring-ahorro)] max-md:bg-[var(--cn-color-ink)] max-md:shadow-[var(--cn-mark-ring-on-ink-ahorro)]",
  },
  labelTone: {
    pagado: "text-[var(--cn-color-text-secondary)]",
    vencido: "text-[var(--cn-color-problem)]",
    entrada: "text-[var(--cn-color-casa)]",
    viene: "text-[var(--cn-color-text)]",
    cierre: "text-[var(--cn-color-ahorro-text)]",
  },
  popover:
    "absolute z-[3] top-[calc(var(--ds-cn-line-height)-var(--spacing)*4.5+var(--cn-line-extra-rows,0)*var(--ds-cn-line-row))] left-[clamp(calc(var(--ds-cn-popover-width)/2),var(--cn-pop-left),calc(100%-var(--ds-cn-popover-width)/2))] w-[var(--ds-cn-popover-width)] max-w-[calc(100vw-var(--spacing)*8)] -translate-x-1/2 rounded-[var(--ds-radius-tab)] bg-[var(--cn-color-ink)] px-3.5 py-3 text-[var(--cn-color-on-ink)] shadow-[var(--cn-shadow-overlay)] max-md:top-9 max-md:bg-[var(--cn-color-surface)] max-md:text-[var(--cn-color-text)]",
  popHead: "flex items-baseline justify-between gap-2",
  popDate: "text-xs text-[var(--cn-color-on-ink-soft)] max-md:text-[var(--cn-color-text-secondary)]",
  popClose: `inline-flex size-7 items-center justify-center rounded-[var(--ds-radius-sm)] border-0 bg-transparent text-base text-[var(--cn-color-on-ink-soft)] cursor-pointer max-md:text-[var(--cn-color-text-secondary)] ${focus}`,
  popTitle: "text-[length:var(--text-cn-input)] font-[var(--font-weight-semibold)]",
  popDetail: "text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-on-ink-soft)] max-md:text-[var(--cn-color-text-secondary)]",
  popAction: `mt-2.5 inline-flex min-h-8.5 items-center rounded-[var(--ds-radius-icon)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-semibold)] text-[var(--cn-color-text)] no-underline max-md:bg-[var(--cn-color-action)] max-md:text-[var(--cn-color-on-ink)] ${focus}`,
} as const;

/** Folder tabs in three groups. */
export const cnTabRecipes = {
  nav: "mt-3.5 overflow-x-auto max-md:-mx-5 max-md:px-3",
  row: "flex w-max gap-0.5",
  separator: "mx-2 h-5.5 w-px self-center bg-[var(--cn-color-border)] max-md:bg-[var(--cn-color-ink-raised)]",
  tab: `inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-t-[var(--ds-radius-tab)] px-5 text-sm font-[var(--font-weight-medium)] text-[var(--cn-color-text-muted)] no-underline transition-colors duration-[var(--ds-duration-fast)] hover:text-[var(--cn-color-text)] max-md:min-h-11 max-md:px-4 max-md:text-[var(--cn-color-on-ink-soft)] max-md:hover:text-[var(--cn-color-on-ink)] aria-[current=page]:bg-[var(--cn-color-paper)] aria-[current=page]:font-[var(--font-weight-semibold)] aria-[current=page]:text-[var(--cn-color-text)] ${focus} focus-visible:outline-offset-[-2px]`,
  dot: "size-[var(--ds-cn-swatch)] flex-none rounded-[var(--ds-radius-chip)]",
  /** The Negocio dot is ink; on the phone's ink header it needs a light edge to show. */
  dotOnInk: "max-md:shadow-[var(--cn-mark-ring-on-ink-light)]",
} as const;

/** The paper sheet under the folder tabs. */
export const cnPaperRecipes = {
  sheet:
    "flex flex-col gap-5.5 rounded-b-[var(--ds-radius-xl)] border border-t-0 border-[var(--cn-color-border)] bg-[var(--cn-color-paper)] p-7 max-md:rounded-none max-md:border-0 max-md:px-4 max-md:py-4.5 max-md:gap-3.5",
  empty: "min-h-[var(--ds-chart-height-empty)]",
} as const;
