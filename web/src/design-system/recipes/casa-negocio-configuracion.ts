/**
 * Recipes of the Configuración tab of Casa y Negocio
 * (docs/design-system/lienzo-casa-negocio/Configuracion.dc.html).
 *
 * A file of its own, next to `casa-negocio.ts`, so the tabs built in
 * parallel do not edit the same recipe object. Same rules: every value is a
 * `--cn-*` role, a typography role, a `--ds-*` geometry token or a step of
 * Tailwind's spacing scale.
 */
import { cnTypeRecipes } from "./casa-negocio";

const focus = cnTypeRecipes.focus;

/** White field used in the editors and inline inputs. */
const control = `min-h-11 w-full rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-input)] font-[var(--font-weight-regular)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] read-only:bg-[var(--cn-color-well)] disabled:bg-[var(--cn-color-well)] aria-invalid:border-[var(--cn-color-problem)] ${focus}`;

export const cnConfigRecipes = {
  section: "flex flex-col gap-3.5",
  sectionTitle: cnTypeRecipes.section,
  sectionHead: "flex flex-wrap items-baseline justify-between gap-2.5",

  /* Cuentas */
  accounts: "grid grid-cols-[repeat(auto-fit,minmax(var(--ds-cn-config-card-min),1fr))] gap-3",
  account: `flex flex-col gap-1.5 rounded-[var(--ds-radius-panel)] border-0 bg-[var(--cn-color-surface)] p-4 text-left text-[var(--cn-color-text)] enabled:cursor-pointer enabled:hover:shadow-[var(--cn-ring-soft)] disabled:cursor-default ${focus}`,
  accountArchived: "opacity-60",
  accountBar: "h-1.5 w-7 rounded-full",
  accountBarTone: {
    efectivo: "bg-[var(--cn-color-text-faint)]",
    banco: "bg-[var(--cn-color-ink)]",
    billetera: "bg-[var(--cn-color-text-secondary)]",
    casa: "bg-[var(--cn-color-casa)]",
    ahorro: "bg-[var(--cn-color-ahorro)]",
  },
  accountName: "text-base font-[var(--font-weight-semibold)]",
  accountType: "text-xs text-[var(--cn-color-text-muted)]",
  accountOpening: "text-xs tabular-nums text-[var(--cn-color-text-secondary)]",
  accountTag: "text-xs font-[var(--font-weight-semibold)] text-[var(--cn-color-ahorro-text)]",
  addCard: `min-h-24 rounded-[var(--ds-radius-panel)] border-2 border-dashed border-[var(--cn-color-border-dashed)] bg-transparent text-sm font-[var(--font-weight-semibold)] text-[var(--cn-color-text-secondary)] cursor-pointer ${focus}`,
  archivedToggle: `inline-flex min-h-11 items-center self-start rounded-[var(--ds-radius-sm)] border-0 bg-transparent px-1 text-xs font-[var(--font-weight-semibold)] text-[var(--cn-color-text-secondary)] underline underline-offset-2 cursor-pointer ${focus}`,

  /* Gastos de la casa */
  metaLabel: "inline-flex flex-wrap items-center gap-2.5 text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-text-secondary)]",
  metaValue: "text-[length:var(--text-cn-figure-xs)] font-[var(--font-weight-light)] tabular-nums text-[var(--cn-color-text)]",
  metaInput: `min-h-11 w-[var(--ds-cn-config-meta)] rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-3 text-[length:var(--text-cn-figure-xs)] font-[var(--font-weight-light)] leading-[var(--leading-tight)] tabular-nums text-[var(--cn-color-text)] read-only:bg-transparent aria-invalid:border-[var(--cn-color-problem)] ${focus}`,
  columns: "flex flex-wrap items-start gap-4",
  column: "flex min-w-0 flex-[1_1_var(--ds-cn-config-column)] flex-col gap-2.5 rounded-[var(--ds-radius-card)] p-4 max-md:p-3",
  columnTone: { FIJO: "bg-[var(--cn-color-track)]", VARIABLE: "bg-[var(--cn-color-casa-tint)]" },
  columnHead: "flex items-baseline justify-between gap-2 px-1",
  columnTitle: `${cnTypeRecipes.eyebrow}`,
  columnTitleTone: { FIJO: "text-[var(--cn-color-text)]", VARIABLE: "text-[var(--cn-color-casa)]" },
  columnTotal: "text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-text-secondary)]",
  columnEmpty: "px-1 py-2 text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-text-muted)]",
  columnAdd: `min-h-11 rounded-[var(--ds-radius-tab)] border-2 border-dashed border-[var(--cn-color-border-dashed)] bg-transparent text-sm font-[var(--font-weight-semibold)] text-[var(--cn-color-text-secondary)] cursor-pointer ${focus}`,
  expense: "flex items-center gap-3 rounded-[var(--ds-radius-tab)] bg-[var(--cn-color-surface)] px-3.5 py-3",
  expenseInactive: "opacity-60",
  expenseBody: `min-w-0 flex-1 rounded-[var(--ds-radius-sm)] border-0 bg-transparent p-0 text-left text-[var(--cn-color-text)] enabled:cursor-pointer disabled:cursor-default ${focus}`,
  expenseName: "block text-[length:var(--text-cn-input)] font-[var(--font-weight-semibold)]",
  expenseSub: "block text-xs text-[var(--cn-color-text-muted)]",
  expenseAmount: "text-[length:var(--text-cn-input)] tabular-nums",
  move: `inline-flex size-11 flex-none items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-paper)] text-base text-[var(--cn-color-text-secondary)] cursor-pointer disabled:cursor-wait disabled:opacity-50 ${focus}`,

  /* Avisos */
  list: "rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] py-1.5",
  rule: "flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--cn-color-flap)] px-5 py-3 first:border-t-transparent max-md:px-4",
  switch: `group relative h-6.5 w-11 flex-none rounded-full border-0 p-0 before:absolute before:inset-x-0 before:-inset-y-2.25 before:content-[''] bg-[var(--cn-color-border-dashed)] aria-checked:bg-[var(--cn-color-ink)] enabled:cursor-pointer disabled:cursor-default ${focus}`,
  switchKnob:
    "absolute top-0.75 left-[var(--ds-cn-config-switch-off)] size-5 rounded-full bg-[var(--cn-color-surface)] transition-[left] duration-[var(--ds-duration-fast)] group-aria-checked:left-[var(--ds-cn-config-switch-on)]",
  severity: "size-2.5 flex-none rounded-[var(--ds-radius-chip)]",
  severityTone: { atencion: "bg-[var(--cn-color-attention)]", problema: "bg-[var(--cn-color-problem)]" },
  ruleText: "flex-[1_1_20rem] text-[length:var(--text-cn-input)]",
  ruleTextOn: "text-[var(--cn-color-text)]",
  ruleTextOff: "text-[var(--cn-color-text-faint)]",
  umbral: `mx-1.5 min-h-8.5 max-md:min-h-11 w-[var(--ds-cn-config-umbral)] rounded-[var(--ds-radius-sm)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-2 text-center text-[length:var(--text-cn-input)] font-[var(--font-weight-regular)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] read-only:bg-transparent aria-invalid:border-[var(--cn-color-problem)] ${focus}`,
  umbralValue: "mx-1.5 font-[var(--font-weight-semibold)] tabular-nums",
  ruleWhere: "text-xs text-[var(--cn-color-text-muted)]",
  inlineError: "basis-full text-xs text-[var(--cn-color-problem)]",

  /* Quién puede qué */
  matrixWrap: "overflow-x-auto rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] py-2",
  matrix: "w-full min-w-[var(--ds-cn-config-matrix-min)] border-collapse",
  matrixHead: "text-xs text-[var(--cn-color-text-muted)]",
  matrixHeadPerson: "px-5 py-3 text-left font-[var(--font-weight-medium)]",
  matrixHeadCap: "p-3 text-center font-[var(--font-weight-medium)]",
  matrixRow: "border-t border-[var(--cn-color-flap)]",
  matrixPerson: "px-5 py-3.5 text-left",
  person: "inline-flex items-center gap-2.5 text-[length:var(--text-cn-input)] font-[var(--font-weight-semibold)]",
  personAvatar:
    "inline-flex size-8.5 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--cn-color-ink)] text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-on-ink)]",
  personImage: "size-full object-cover",
  personMeta: "block text-xs font-[var(--font-weight-regular)] text-[var(--cn-color-text-muted)]",
  matrixCell: "p-2.5 text-center",
  capToggle: `inline-flex size-11 items-center justify-center rounded-[var(--ds-radius-tab)] border-0 bg-[var(--cn-color-surface)] text-[var(--cn-color-border-dashed)] shadow-[inset_0_0_0_2px_var(--cn-color-border-soft)] aria-checked:bg-[var(--cn-color-ink)] aria-checked:text-[var(--cn-color-on-ink)] aria-checked:shadow-[inset_0_0_0_2px_var(--cn-color-ink)] enabled:cursor-pointer disabled:cursor-default ${focus}`,
  matrixError: "px-5 pb-3 text-xs text-[var(--cn-color-problem)]",

  /* Editors (native <dialog>) */
  dialog:
    "m-auto w-[var(--ds-cn-config-dialog)] max-w-[calc(100vw-var(--spacing)*8)] rounded-[var(--ds-radius-card)] border-0 bg-[var(--cn-color-paper)] p-0 text-[var(--cn-color-text)] shadow-[var(--cn-shadow-overlay)] backdrop:bg-[var(--color-overlay-backdrop)]",
  dialogForm: "flex flex-col gap-4 p-6 max-md:p-4.5",
  dialogTitle: cnTypeRecipes.section,
  fields: "grid grid-cols-2 gap-3 max-md:grid-cols-1",
  fieldWide: "col-span-full",
  field: "flex flex-col gap-1 text-xs text-[var(--cn-color-text-secondary)]",
  control,
  fieldError: "text-xs text-[var(--cn-color-problem)]",
  check: "inline-flex min-h-11 items-center gap-2 text-sm text-[var(--cn-color-text)]",
  checkBox: `size-4.5 accent-[var(--cn-color-ink)] ${focus}`,
  hint: "text-xs text-[var(--cn-color-text-muted)]",
  formError: "rounded-[var(--ds-radius-md)] bg-[var(--cn-color-problem-surface)] px-3 py-2 text-[length:var(--text-cn-eyebrow)] text-[var(--cn-color-problem-text)]",
  footer: "flex flex-wrap items-center justify-between gap-2",
  footerSide: "flex flex-wrap gap-2",
  secondary: `min-h-11 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-border)] bg-[var(--cn-color-surface)] px-4.5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-text)] cursor-pointer disabled:cursor-wait disabled:opacity-50 ${focus}`,
  danger: `min-h-11 rounded-[var(--ds-radius-md)] border border-[var(--cn-color-problem-ring)] bg-[var(--cn-color-surface)] px-4.5 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-problem)] cursor-pointer disabled:cursor-wait disabled:opacity-50 ${focus}`,
  primary: `min-h-11 rounded-[var(--ds-radius-md)] border-0 bg-[var(--cn-color-action)] px-6 text-sm font-[var(--font-weight-semibold)] leading-[var(--leading-tight)] text-[var(--cn-color-on-ink)] cursor-pointer hover:bg-[var(--cn-color-action-hover)] disabled:cursor-wait disabled:opacity-50 ${focus}`,

  /* States */
  notice: "rounded-[var(--ds-radius-card)] bg-[var(--cn-color-surface)] px-6 py-5 text-[length:var(--text-cn-input)] text-[var(--cn-color-text-secondary)]",
  skeleton: "animate-pulse rounded-[var(--ds-radius-panel)] bg-[var(--cn-color-track)]",
  skeletonCard: "h-24",
  skeletonColumn: "h-72 flex-[1_1_var(--ds-cn-config-column)]",
  skeletonList: "h-80",
  skeletonTitle: "h-7 w-48",
} as const;
