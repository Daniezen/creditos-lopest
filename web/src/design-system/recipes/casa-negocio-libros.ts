/**
 * Class recipes of the Casa and Negocio tabs (`Casa.dc.html`,
 * `Negocio.dc.html`): the month strip with its equation, the «Anotar» forms,
 * the books (by day for Casa, cash book with running balance for Negocio),
 * the right column (fijos, sobres), account filters, the inline account
 * picker and the edit/void dialog.
 *
 * Same contract as `casa-negocio.ts`: every value is a `--cn-*` role, a
 * typography role, a geometry token or a Tailwind spacing step. Kept in its
 * own file so the tabs built in parallel do not edit the same module.
 */
import { cnTypeRecipes } from "./casa-negocio";

const focus = cnTypeRecipes.focus;

/**
 * Touch targets: the canvas draws segments, chips and the pencil at 36-40 px
 * for a mouse. On a phone width or any coarse pointer (a tablet next to the
 * PC) they grow to 44 px (`11` steps), the minimum a fingertip hits reliably.
 */
const tactil = "max-md:min-h-11 pointer-coarse:min-h-11";
const tactilCuadrado = "max-md:size-11 pointer-coarse:size-11";

/** Franja: identity label, then the equation as white wells joined by operators. */
export const cnStripRecipes = {
  root: "flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[var(--ds-radius-card)] px-5 py-4 max-md:px-4",
  casa: "bg-[var(--cn-color-casa-tint)]",
  negocio: "bg-[var(--cn-color-negocio-tint)]",
  label: `${cnTypeRecipes.eyebrow} mr-2 inline-flex items-center gap-2 font-[var(--font-weight-bold)]`,
  labelCasa: "text-[var(--cn-color-casa)]",
  labelNegocio: "text-[var(--cn-color-text)]",
  labelSwatch: "size-2.5 rounded-[var(--ds-radius-chip)]",
  operator: "text-[length:var(--text-cn-figure-sm)] font-[var(--font-weight-light)] text-[var(--cn-color-operator)]",
  term: "inline-flex flex-col rounded-[var(--ds-radius-md)] bg-[var(--cn-color-surface)] px-3 py-1.5",
  termResult: "inline-flex flex-col rounded-[var(--ds-radius-md)] bg-[var(--cn-color-ink)] px-3 py-1.5",
  termLabel: "text-[length:var(--text-2xs)] text-[var(--cn-color-text-secondary)]",
  termLabelResult: "text-[length:var(--text-2xs)] text-[var(--cn-color-on-ink-soft)]",
  termValue: `${cnTypeRecipes.figureXsMedium} font-[var(--font-weight-light)] text-[var(--cn-color-text)]`,
  termValueResult:
    "text-[length:var(--text-cn-figure-xs)] font-[var(--font-weight-regular)] tabular-nums text-[var(--cn-color-on-ink)]",
  notice: "basis-full",
} as const;

/** White card that holds a form or a list. */
export const cnCardRecipes = {
  card: "flex min-w-0 flex-col gap-4 rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] px-6 py-5.5 max-md:px-4 max-md:py-4",
  cardTight: "min-w-0 rounded-[var(--ds-radius-panel)] bg-[var(--cn-color-surface)] p-5 max-md:p-4",
  head: "flex flex-wrap items-center justify-between gap-3",
  title: cnTypeRecipes.section,
  titleSm: "m-0 mb-2.5 text-[length:var(--text-cn-figure-sm)] font-[var(--font-weight-display)]",
  empty: "rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] px-6 py-8 text-center text-sm text-[var(--cn-color-text-secondary)]",
  hint: "text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-text-secondary)]",
  link: `font-[var(--font-weight-semibold)] text-[var(--cn-color-link)] underline underline-offset-2 ${focus}`,
} as const;

/** «Anotar en la casa» / «Anotar en el negocio». */
export const cnFormRecipes = {
  segmented: "inline-flex flex-wrap rounded-[var(--ds-radius-tab)] bg-[var(--cn-color-flap)] p-1",
  segment: `min-h-10 rounded-[var(--ds-radius-icon)] border-0 bg-transparent px-4.5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text-secondary)] cursor-pointer disabled:cursor-not-allowed ${tactil} ${focus}`,
  segmentCasa: "aria-pressed:bg-[var(--cn-color-casa)] aria-pressed:text-[var(--cn-color-on-ink)]",
  segmentNegocio: "aria-pressed:bg-[var(--cn-color-ink)] aria-pressed:text-[var(--cn-color-on-ink)]",
  chips: "flex flex-wrap items-center gap-2",
  chipsLabel: "text-xs text-[var(--cn-color-text-secondary)]",
  chip: `min-h-9 rounded-full border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3.5 text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] cursor-pointer aria-pressed:border-[var(--cn-color-action)] aria-pressed:bg-[var(--cn-color-well)] aria-pressed:text-[var(--cn-color-link)] ${tactil} ${focus}`,
  chipOverdue: "text-[var(--cn-color-problem)]",
  lead: "text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-text-secondary)]",
  fields: "grid grid-cols-[repeat(auto-fit,minmax(var(--ds-cn-form-field-min),1fr))] gap-3 max-md:grid-cols-1",
  field: "flex min-w-0 flex-col gap-1 text-xs text-[var(--cn-color-text-secondary)]",
  control: `min-h-12 w-full rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-input)] font-[var(--font-weight-regular)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[var(--cn-color-problem)] ${focus}`,
  amount: `min-h-12 w-full rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-figure-sm)] font-[var(--font-weight-light)] leading-[var(--leading-tight)] tabular-nums text-[var(--cn-color-text)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[var(--cn-color-problem)] ${focus}`,
  fieldError: "text-xs text-[var(--cn-color-problem)]",
  footer: "flex flex-wrap items-center justify-end gap-3",
  status: "mr-auto text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-ok)]",
  statusError: "mr-auto text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-problem)]",
  submit: `min-h-12 rounded-[var(--ds-radius-md)] border-0 bg-[var(--cn-color-action)] px-7 text-[length:var(--text-cn-input)] font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-on-ink)] cursor-pointer hover:bg-[var(--cn-color-action-hover)] disabled:cursor-wait disabled:opacity-60 max-md:w-full ${focus}`,
  secondary: `min-h-12 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] cursor-pointer disabled:cursor-wait ${focus}`,
  danger: `min-h-12 rounded-[var(--ds-radius-md)] border-0 bg-[var(--cn-color-problem)] px-5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-on-ink)] cursor-pointer disabled:cursor-wait disabled:opacity-60 ${focus}`,
} as const;

/** Casa: book by day and the right column. */
export const cnCasaRecipes = {
  layout: "flex flex-wrap items-start gap-5.5 max-md:gap-3.5",
  book: "flex min-w-0 flex-[999_1_var(--ds-cn-book-min)] flex-col gap-3 outline-none",
  aside: "flex min-w-0 flex-[1_1_var(--ds-cn-aside-min)] flex-col gap-4",
  day: "flex gap-4.5 rounded-[var(--ds-radius-panel)] bg-[var(--cn-color-surface)] px-5 py-4 max-md:gap-3 max-md:px-3.5 max-md:py-3",
  dayHead: "w-[var(--ds-cn-day-col)] flex-none text-center max-md:w-10",
  dayNumber: `${cnTypeRecipes.figureXl} leading-none max-md:text-[length:var(--text-cn-figure-lg)]`,
  dayWeek: "mt-0.5 text-xs text-[var(--cn-color-text-muted)]",
  dayRows: "min-w-0 flex-1",
  row: "flex items-center gap-3 border-b border-[var(--cn-color-flap)] py-2 last:border-b-0",
  dotFijo: "size-2.5 flex-none rounded-full bg-[var(--cn-color-ink)]",
  dotVariable: "size-2.5 flex-none rounded-full bg-[var(--cn-color-text-faint)]",
  dotIngreso: "size-2.5 flex-none rounded-[var(--ds-radius-chip)] bg-[var(--cn-color-casa)]",
  dotOtro: "size-2.5 flex-none rounded-[var(--ds-radius-chip)] bg-[var(--cn-color-ahorro)]",
  rowBody: "min-w-0 flex-1",
  rowName: "truncate text-[length:var(--text-cn-input)] font-[var(--font-weight-medium)]",
  rowSub: "truncate text-xs text-[var(--cn-color-text-muted)]",
  rowAmount: "whitespace-nowrap text-[length:var(--text-cn-figure-xs)] font-[var(--font-weight-regular)] tabular-nums",
  amountIn: "text-[var(--cn-color-casa)]",
  amountOut: "text-[var(--cn-color-text)]",
  amountNeutral: "text-[var(--cn-color-text-muted)]",
  rowEdit: `inline-flex size-9 flex-none items-center justify-center rounded-[var(--ds-radius-sm)] border-0 bg-transparent text-[var(--cn-color-text-secondary)] cursor-pointer hover:bg-[var(--cn-color-well)] ${tactilCuadrado} ${focus}`,

  fijo: "flex items-center gap-3 py-2.25",
  check: "inline-flex size-[var(--ds-cn-check)] flex-none items-center justify-center rounded-full text-[var(--cn-color-on-ink)]",
  checkPagado: "bg-[var(--cn-color-ink)]",
  checkVencido: "bg-[var(--cn-color-surface)] shadow-[inset_0_0_0_2px_var(--cn-color-problem)]",
  checkPorVenir: "bg-[var(--cn-color-surface)] shadow-[inset_0_0_0_2px_var(--cn-color-ink)]",
  checkNoToca: "bg-[var(--cn-color-surface)] shadow-[inset_0_0_0_2px_var(--cn-color-border)]",
  fijoName: "text-sm font-[var(--font-weight-medium)]",
  fijoSub: "text-xs text-[var(--cn-color-text-muted)]",
  fijoSubProblem: "text-xs text-[var(--cn-color-problem)]",
  fijoFaint: "text-[var(--cn-color-text-faint)]",
  fijoAmount: "text-sm tabular-nums",
  fijoNotice: "mb-1.5",

  sobre: "py-2",
  sobreHead: "flex justify-between gap-2.5 text-sm",
  sobreName: "font-[var(--font-weight-medium)]",
  sobreLeft: "tabular-nums text-[var(--cn-color-text)]",
  sobreLeftOver: "tabular-nums text-[var(--cn-color-problem)]",
  sobreTrack: "mt-1.5 h-1.25 overflow-hidden rounded-full bg-[var(--cn-color-track)]",
  sobreFill: {
    NORMAL: "h-1.25 bg-[var(--cn-color-casa)]",
    CERCA: "h-1.25 bg-[var(--cn-color-attention)]",
    PASADO: "h-1.25 bg-[var(--cn-color-problem)]",
  },
  sobreNotice: "mt-1.5",
} as const;

/** Negocio: account filters, cash book, accounts still to assign. */
export const cnNegocioRecipes = {
  filters: "grid grid-cols-[repeat(auto-fit,minmax(var(--ds-cn-filter-min),1fr))] gap-3.5 max-md:grid-cols-2 max-md:gap-2.5",
  filter: `flex flex-col items-start rounded-[var(--ds-radius-card)] border-0 bg-[var(--cn-color-surface)] px-5 py-4.5 text-left text-[var(--cn-color-text)] cursor-pointer aria-pressed:bg-[var(--cn-color-ink)] aria-pressed:text-[var(--cn-color-on-ink)] max-md:px-3.5 max-md:py-3 ${focus}`,
  filterName: "text-[length:var(--text-cn-eyebrow)] font-[var(--font-weight-semibold)] opacity-80",
  filterBalance: `${cnTypeRecipes.figure} mt-1.5 text-[length:var(--text-cn-display-sm)] max-md:text-[length:var(--text-cn-figure-sm)]`,
  filterSub: "mt-0.5 text-xs opacity-75",
  filterSubProblem: "mt-0.5 text-xs font-[var(--font-weight-semibold)]",
  filterNotice: "mt-1",

  /** Query container of the book: the table/cards switch reads its width. */
  bookFrame: "@container min-w-0 outline-none",
  /** 56 rem (`@4xl`) is the narrowest the seven columns read without squeezing. */
  book: "hidden overflow-x-auto rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] py-2 @4xl:block",
  table: "w-full border-collapse text-sm",
  th: "px-3 py-3 text-left text-xs font-[var(--font-weight-medium)] text-[var(--cn-color-text-muted)] first:pl-5 last:pr-5",
  thNum: "px-3 py-3 text-right text-xs font-[var(--font-weight-medium)] text-[var(--cn-color-text-muted)] last:pr-5",
  tr: "border-t border-[var(--cn-color-flap)] align-middle",
  tdDay: `${cnTypeRecipes.section} w-12 py-3 pl-5 pr-3`,
  td: "px-3 py-3",
  tdMuted: "whitespace-nowrap px-3 py-3 text-[var(--cn-color-text-secondary)]",
  tdNum: "whitespace-nowrap px-3 py-3 text-right tabular-nums text-[var(--cn-color-text-secondary)]",
  tdEffect: "whitespace-nowrap px-3 py-3 text-right text-base tabular-nums",
  tdBalance: "whitespace-nowrap py-3 pl-3 pr-5 text-right tabular-nums text-[var(--cn-color-text-muted)]",
  move: "flex items-center gap-2.5",
  badgeAuto:
    "inline-flex size-[var(--ds-cn-badge)] flex-none items-center justify-center rounded-[var(--ds-radius-sm)] bg-[image:var(--cn-brand-mark)] text-xs font-[var(--font-weight-bold)] text-[var(--cn-color-on-ink)]",
  badgeManual:
    "inline-flex size-[var(--ds-cn-badge)] flex-none items-center justify-center rounded-[var(--ds-radius-sm)] bg-[var(--cn-color-flap)] text-[var(--cn-color-text-secondary)]",
  moveName: "font-[var(--font-weight-semibold)]",
  moveSub: "text-xs text-[var(--cn-color-text-muted)]",
  owner: "ml-1 rounded-full bg-[var(--cn-color-well)] px-2 py-0.5 text-[length:var(--text-2xs)] font-[var(--font-weight-semibold)] text-[var(--cn-color-text-label)]",
  effectIn: "text-[var(--cn-color-casa)]",
  effectOut: "text-[var(--cn-color-text)]",
  effectNeutral: "text-[var(--cn-color-text-muted)]",

  cards: "flex flex-col gap-2.5 @4xl:hidden",
  card: "flex flex-col gap-2 rounded-[var(--ds-radius-panel)] bg-[var(--cn-color-surface)] p-3.5",
  cardTop: "flex items-start gap-3",
  cardDay: `${cnTypeRecipes.figureSm} w-8 flex-none leading-none`,
  cardBody: "min-w-0 flex-1",
  cardFoot: "flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--cn-color-text-secondary)]",

  assign: "flex flex-wrap items-center gap-2",
  assignLabel: "text-xs font-[var(--font-weight-semibold)] text-[var(--cn-color-attention-text)]",
  assignSelect: `min-h-10 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-attention-ring)] bg-[var(--cn-color-attention-surface)] px-2.5 text-sm text-[var(--cn-color-text)] disabled:cursor-wait disabled:opacity-60 aria-invalid:border-[var(--cn-color-problem)] ${tactil} ${focus}`,
  assignError: "basis-full text-xs text-[var(--cn-color-problem)]",
  assignSave: `min-h-10 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3.5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] cursor-pointer disabled:cursor-wait disabled:opacity-60 ${tactil} ${focus}`,
  pending: "flex flex-col gap-1 rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] px-6 py-5 max-md:px-4",
  pendingRow: "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--cn-color-flap)] py-3 first:border-t-0",
  pendingBody: "min-w-0 flex-[1_1_var(--ds-cn-form-field-min)]",
  pendingAmount: "whitespace-nowrap text-[length:var(--text-cn-input)] tabular-nums",
} as const;

/** Edit / void dialog (native `<dialog>`). */
export const cnDialogRecipes = {
  dialog:
    "m-auto max-h-[calc(100dvh-var(--spacing)*8)] w-[var(--ds-cn-dialog-width)] max-w-[calc(100vw-var(--spacing)*8)] overflow-y-auto rounded-[var(--ds-radius-card)] border-0 bg-[var(--cn-color-paper)] p-0 text-[var(--cn-color-text)] shadow-[var(--cn-shadow-overlay)] backdrop:bg-[var(--color-overlay-backdrop)]",
  body: "flex flex-col gap-4 p-6 max-md:p-4",
  title: cnTypeRecipes.section,
  text: "text-sm text-[var(--cn-color-text-secondary)]",
  fields: "grid grid-cols-1 gap-3",
  footer: "flex flex-wrap justify-end gap-2",
  between: "flex flex-wrap items-center justify-between gap-2",
} as const;

/** Loading skeleton blocks. */
export const cnSkeletonRecipes = {
  block: "animate-pulse rounded-[var(--ds-radius-card)] bg-[var(--cn-color-track)]",
  strip: "h-20",
  form: "h-56",
  book: "h-96",
} as const;
