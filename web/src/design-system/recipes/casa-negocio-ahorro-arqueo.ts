/**
 * Class recipes of the Ahorro and Arqueo tabs of Casa y Negocio
 * (`Ahorro.dc.html`, `Arqueo.dc.html`). Same rules as `casa-negocio.ts`:
 * every value is a `--cn-*` role, a typography role, a geometry token or a
 * step of Tailwind's spacing scale. Kept in its own file so the tabs built in
 * parallel never edit the same recipe object.
 */
import { cnTypeRecipes } from "./casa-negocio";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cn-color-focus)]";

/** Big primary button of both tabs (52px tall, 14px radius, 16px label). */
const bigButton = `inline-flex min-h-13 items-center justify-center rounded-[var(--ds-radius-tab)] border-0 px-6 text-base leading-[var(--leading-tight)] cursor-pointer transition-colors duration-[var(--ds-duration-fast)] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

const card = "min-w-0 rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)]";

/** Ahorro: goal ring, the dark «Cierre de …» card and the deposits by month. */
export const cnAhorroRecipes = {
  top: "flex flex-wrap items-stretch gap-5.5 max-md:gap-3.5",
  goal: `${card} flex flex-[1_1_var(--ds-cn-ahorro-card-min)] flex-wrap items-center gap-7 p-6.5 max-md:flex-col max-md:items-start max-md:gap-5 max-md:p-5`,
  ring: "relative size-[var(--ds-cn-ring)] flex-none max-md:self-center",
  ringSvg: "size-full -rotate-90",
  ringTrack: "fill-none stroke-[var(--cn-color-flap)]",
  ringFill: "fill-none stroke-[var(--cn-color-ahorro)] transition-[stroke-dasharray] duration-[var(--ds-duration-slow)]",
  ringCenter: "absolute inset-0 flex flex-col items-center justify-center",
  ringFigure: "text-[length:var(--text-cn-figure-ring)] font-[var(--font-weight-figure)] leading-none tabular-nums",
  ringCaption: "mt-1 text-xs text-[var(--cn-color-text-muted)]",
  goalText: "flex min-w-0 flex-col gap-1.5",
  goalEyebrow: `${cnTypeRecipes.eyebrow} m-0 text-[var(--cn-color-ahorro-text)]`,
  goalBalance: "text-[length:var(--text-cn-figure-ring)] font-[var(--font-weight-figure)] tabular-nums",
  goalDetail: "text-sm text-[var(--cn-color-text-secondary)]",
  goalLink: `text-sm font-[var(--font-weight-semibold)] text-[var(--cn-color-link)] underline underline-offset-2 ${focus}`,

  closing: `flex flex-[1_1_var(--ds-cn-ahorro-card-min)] min-w-0 flex-col justify-between gap-4.5 rounded-[var(--ds-radius-card)] bg-[var(--cn-color-ink)] p-6.5 text-[var(--cn-color-on-ink)] max-md:p-5`,
  closingEyebrow: `${cnTypeRecipes.eyebrow} m-0 text-[var(--cn-color-on-ink-soft)]`,
  closingFigure: "mt-2 text-[length:var(--text-cn-figure-cierre)] font-[var(--font-weight-figure)] leading-none tabular-nums max-md:text-[length:var(--text-cn-figure-ring)]",
  closingRoute: "mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-[var(--cn-color-on-ink-soft)]",
  closingArrow: "size-4.5 flex-none",
  closingSelect: `min-h-9 rounded-[var(--ds-radius-sm)] border border-[var(--cn-color-ink-raised)] bg-[var(--cn-color-ink)] px-2 text-sm font-[var(--font-weight-regular)] leading-[var(--leading-tight)] text-[var(--cn-color-on-ink)] ${focus}`,
  closingDone: "text-sm text-[var(--cn-color-on-ink-soft)]",
  closingButton: `${bigButton} self-start bg-[var(--cn-color-ahorro-on-ink)] font-[var(--font-weight-bold)] text-[var(--cn-color-ink)] max-md:self-stretch`,
  /** Confirmation step inside the dark card. */
  confirm: "flex flex-col gap-3",
  confirmLabel: "flex flex-col gap-1 text-xs text-[var(--cn-color-on-ink-soft)]",
  confirmInput: `min-h-13 rounded-[var(--ds-radius-tab)] border border-[var(--cn-color-ink-raised)] bg-[var(--cn-color-ink-raised)] px-3.5 text-[length:var(--text-cn-figure-input)] font-[var(--font-weight-light)] leading-[var(--leading-tight)] tabular-nums text-[var(--cn-color-on-ink)] ${focus}`,
  confirmActions: "flex flex-wrap gap-2",
  confirmCancel: `${bigButton} border border-[var(--cn-color-ink-raised)] bg-transparent font-[var(--font-weight-semibold)] text-[var(--cn-color-on-ink)]`,
  message: "text-sm text-[var(--cn-color-on-ink-soft)]",
  messageError: "rounded-[var(--ds-radius-md)] bg-[var(--cn-color-problem-surface)] px-3 py-2 text-sm text-[var(--cn-color-problem-text)]",

  months: `${card} px-6 py-5.5 max-md:px-4 max-md:py-4`,
  monthsTitle: `${cnTypeRecipes.section} mb-3.5`,
} as const;

/** Arqueo: «N de M cuadran», per-account cards grouped Negocio / Casa, history and save. */
export const cnArqueoRecipes = {
  summary: "flex flex-wrap items-center justify-between gap-4",
  summaryFigure: "flex items-baseline gap-3.5",
  summaryCount: "text-[length:var(--text-cn-display)] font-[var(--font-weight-figure)] tabular-nums max-md:text-[length:var(--text-cn-display-sm)]",
  summaryLabel: "text-base text-[var(--cn-color-text-secondary)]",
  dots: "flex flex-wrap gap-2",
  dot: "size-[var(--ds-cn-mark)] rounded-full",
  dotTone: {
    CUADRA: "bg-[var(--cn-color-ok)] shadow-[var(--cn-ring-ok-strong)]",
    FALTA: "bg-[var(--cn-color-problem-tint)] shadow-[var(--cn-ring-problem-strong)]",
    SOBRA: "bg-[var(--cn-color-problem-tint)] shadow-[var(--cn-ring-problem-strong)]",
    POR_CONTAR: "bg-[var(--cn-color-surface)] shadow-[var(--cn-ring-uncounted)]",
  },

  notices: "flex flex-wrap gap-2",

  groups: "flex flex-wrap items-start gap-5.5 max-md:flex-col max-md:items-stretch max-md:gap-4.5",
  groupNegocio: "flex min-w-0 flex-[3_1_var(--ds-cn-arqueo-negocio-min)] flex-col gap-3 max-md:flex-auto",
  groupCasa: "flex min-w-0 flex-[2_1_var(--ds-cn-arqueo-casa-min)] flex-col gap-3 max-md:flex-auto",
  groupLabel: `${cnTypeRecipes.eyebrow} m-0 flex items-center gap-2`,
  groupSwatch: "size-2.5 flex-none rounded-[var(--ds-radius-chip)]",
  groupTone: { NEGOCIO: "text-[var(--cn-color-negocio)]", CASA: "text-[var(--cn-color-casa)]" },
  groupSwatchTone: { NEGOCIO: "bg-[var(--cn-color-negocio)]", CASA: "bg-[var(--cn-color-casa)]" },
  grid: "grid grid-cols-[repeat(auto-fit,minmax(var(--ds-cn-arqueo-card-min),1fr))] gap-3.5 max-md:grid-cols-1",

  card: `${card} flex flex-col gap-3.5 p-5`,
  cardTone: {
    CUADRA: "shadow-[var(--cn-ring-ok)]",
    FALTA: "shadow-[var(--cn-ring-problem)]",
    SOBRA: "shadow-[var(--cn-ring-problem)]",
    POR_CONTAR: "shadow-[var(--cn-ring-neutral)]",
  },
  cardName: "text-base font-[var(--font-weight-semibold)]",
  cardLabel: "text-xs text-[var(--cn-color-text-muted)]",
  cardSystem: cnTypeRecipes.figureMd,
  field: "flex flex-col gap-1 text-xs text-[var(--cn-color-text-muted)]",
  input: `min-h-13 w-full rounded-[var(--ds-radius-tab)] border border-[var(--cn-color-border)] bg-[var(--cn-color-paper)] px-3.5 text-[length:var(--text-cn-figure-input)] font-[var(--font-weight-light)] leading-[var(--leading-tight)] tabular-nums text-[var(--cn-color-text)] read-only:cursor-default read-only:opacity-70 ${focus}`,
  result: "flex min-h-8 items-center gap-2.5",
  resultIcon: "inline-flex size-7 flex-none items-center justify-center rounded-full",
  resultIconTone: {
    CUADRA: "bg-[var(--cn-color-ok)] text-[var(--cn-color-on-ink)] shadow-[var(--cn-ring-ok-strong)]",
    FALTA: "bg-[var(--cn-color-problem-tint)] text-[var(--cn-color-problem)] shadow-[var(--cn-ring-problem-strong)]",
    SOBRA: "bg-[var(--cn-color-problem-tint)] text-[var(--cn-color-problem)] shadow-[var(--cn-ring-problem-strong)]",
    POR_CONTAR: "bg-[var(--cn-color-surface)] text-[var(--cn-color-text-faint)] shadow-[var(--cn-ring-uncounted)]",
  },
  resultGlyph: "size-3.5",
  resultText: "text-[length:var(--text-cn-input)] font-[var(--font-weight-semibold)]",
  resultTextTone: {
    CUADRA: "text-[var(--cn-color-ok)]",
    FALTA: "text-[var(--cn-color-problem)]",
    SOBRA: "text-[var(--cn-color-problem)]",
    POR_CONTAR: "text-[var(--cn-color-text-muted)]",
  },
  lastCount: "text-xs text-[var(--cn-color-text-muted)]",

  footer: "flex flex-wrap items-center justify-between gap-3.5 max-md:flex-col max-md:items-stretch",
  history: "m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-text-secondary)]",
  historyLabel: "font-[var(--font-weight-semibold)] text-[var(--cn-color-text)]",
  historyChip: "rounded-full bg-[var(--cn-color-surface)] px-2.5 py-1",
  historyTone: {
    ok: "text-[var(--cn-color-ok)]",
    problema: "text-[var(--cn-color-problem)]",
    atencion: "text-[var(--cn-color-attention-text)]",
  },
  saveRow: "flex flex-col items-end gap-2 max-md:items-stretch",
  save: `${bigButton} bg-[var(--cn-color-action)] font-[var(--font-weight-semibold)] text-[var(--cn-color-on-ink)] hover:bg-[var(--cn-color-action-hover)]`,
  saveMessage: "text-sm text-[var(--cn-color-text-secondary)]",
  saveError: "rounded-[var(--ds-radius-md)] bg-[var(--cn-color-problem-surface)] px-3 py-2 text-sm text-[var(--cn-color-problem-text)]",
} as const;

/** Empty, error, loading and no-access states shared by both tabs. */
export const cnEstadoRecipes = {
  box: `${card} flex flex-col items-start gap-3 p-6.5 max-md:p-5`,
  title: cnTypeRecipes.section,
  text: "m-0 text-sm text-[var(--cn-color-text-secondary)]",
  action: `${bigButton} bg-[var(--cn-color-action)] font-[var(--font-weight-semibold)] text-[var(--cn-color-on-ink)] no-underline hover:bg-[var(--cn-color-action-hover)]`,
  skeletonRow: "flex flex-wrap gap-5.5 max-md:gap-3.5",
  skeleton: "min-h-[var(--ds-chart-height-empty)] flex-[1_1_var(--ds-cn-ahorro-card-min)] animate-pulse rounded-[var(--ds-radius-card)] bg-[var(--cn-color-well)] motion-reduce:animate-none",
  skeletonWide: "min-h-[var(--ds-chart-height-empty)] w-full animate-pulse rounded-[var(--ds-radius-card)] bg-[var(--cn-color-well)] motion-reduce:animate-none",
} as const;
