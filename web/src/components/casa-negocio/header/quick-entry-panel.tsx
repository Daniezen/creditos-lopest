"use client";

import { forwardRef, startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { cnIdentityRecipes, cnQuickEntryRecipes } from "@/design-system/recipes/casa-negocio";
import { ANOTAR_ESTADO_INICIAL, PREFIJO_CUENTA, type AnotarEstado, type CampoAnotar } from "@/features/casa-negocio/anotar";

import { formatMoney } from "../shared/format";
import { Notice } from "../shared/notice";
import type { QuickEntryKind, QuickEntryOptions } from "../types";
import { QUICK_ENTRY_KINDS, quickEntryFields, type QuickEntryPrefill } from "./quick-entry";

/** What a page hands the header for «Anotar». */
export interface QuickEntryConfig {
  options: QuickEntryOptions;
  /** ISO date (yyyy-mm-dd) the date field starts on: today. */
  defaultDate: string;
  /** Opens the panel prefilled (from «Pagar» in a detail window). */
  prefill: QuickEntryPrefill | null;
  /** The same tab without the prefill parameters, to return to after saving or closing. */
  cleanHref: string;
  /**
   * The Server Action that saves (`anotarMovimientoAction`). Without one
   * «Guardar» is disabled (demo data).
   */
  action?: (state: AnotarEstado, formData: FormData) => Promise<AnotarEstado>;
}

export interface QuickEntryPanelProps extends QuickEntryConfig {
  onClose: () => void;
  /** Called once per successful save: the header closes the panel. */
  onSaved: () => void;
}

const DOT = {
  casa: cnIdentityRecipes.dotCasa,
  negocio: cnIdentityRecipes.dotNegocio,
  ahorro: cnIdentityRecipes.dotAhorro,
} as const;

async function noAction(state: AnotarEstado): Promise<AnotarEstado> {
  return state;
}

/** Idempotency key of one save attempt (the service refuses a second movement with it). */
function newOperationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Whole pesos typed the Colombian way («1.500.000», «$ 32.000»); NaN when unreadable. */
export function parseTypedAmount(text: string): number {
  const clean = text.replace(/[$\s.]/g, "").replace(",", ".");
  return clean ? Number(clean) : Number.NaN;
}

/**
 * Notice 7 before saving: the account the money leaves from would end below
 * zero. Emptying it to exactly 0 is fine (same boundary as the engine).
 */
export function noBalanceNotice(options: QuickEntryOptions, originValue: string | undefined, amountText: string): string | null {
  if (!options.avisoSinSaldo || !originValue) return null;
  const id = originValue.startsWith(PREFIJO_CUENTA) ? originValue.slice(PREFIJO_CUENTA.length) : originValue;
  const balance = options.saldos[id];
  const amount = parseTypedAmount(amountText);
  if (balance === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const left = balance - amount;
  return left < 0 ? `${options.nombresCuenta[id] ?? "La cuenta"} quedaría en ${formatMoney(left)}` : null;
}

/** Select whose value is the account money leaves from, for each kind. */
function originName(kind: QuickEntryKind): string | null {
  if (kind === "aporte") return "origen";
  if (kind === "ingresoCasa") return null;
  return "cuentaOrigen";
}

/**
 * «Anotar rápido»: the six movement types as a pressed-button group, and the
 * two selects of the chosen type (`quick-entry.ts`), amount and date. The
 * selects remount when the type changes (their key), so a stale choice from
 * another type is never submitted.
 *
 * SAVING. The form is submitted by hand (`startTransition` + the action
 * from `useActionState`) instead of `<form action>`, because React resets an
 * action form after every submission and a refused save must keep what was
 * typed. While a save is in flight «Guardar» is disabled and a second submit
 * is ignored; on top of that every attempt carries an idempotency key that is
 * renewed only after a successful save, so even a replayed request cannot
 * write the movement twice. Errors sit under their own field.
 */
export const QuickEntryPanel = forwardRef<HTMLElement, QuickEntryPanelProps>(function QuickEntryPanel(
  { options, defaultDate, prefill, action, onClose, onSaved },
  ref,
) {
  const [kind, setKind] = useState<QuickEntryKind>(prefill?.kind ?? "gastoCasa");
  const [state, formAction, pending] = useActionState(action ?? noAction, ANOTAR_ESTADO_INICIAL);
  const [submittedKind, setSubmittedKind] = useState<QuickEntryKind | null>(null);
  const keyRef = useRef<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const fields = quickEntryFields(kind, options);

  const initialValue = (name: string, list: { value: string }[]) => {
    const wanted = prefill?.kind === kind ? prefill.values[name] : undefined;
    return wanted && list.some((option) => option.value === wanted) ? wanted : list[0]?.value;
  };
  const [draft, setDraft] = useState<{ origin?: string; amount: string }>(() => ({
    origin: initialValue(originName(kind) ?? "", fields.find((f) => f.name === originName(kind))?.options ?? []),
    amount: prefill?.monto ?? "",
  }));

  // One save, one close: `guardados` grows only on success.
  const saves = useRef(state.guardados);
  useEffect(() => {
    if (state.guardados === saves.current) return;
    saves.current = state.guardados;
    keyRef.current = null;
    onSaved();
  }, [state.guardados, onSaved]);

  function chooseKind(next: QuickEntryKind) {
    setKind(next);
    const origin = originName(next);
    const list = quickEntryFields(next, options).find((f) => f.name === origin)?.options ?? [];
    setDraft((current) => ({ ...current, origin: origin ? list[0]?.value : undefined }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !action) return;
    keyRef.current ??= newOperationKey();
    if (keyInputRef.current) keyInputRef.current.value = keyRef.current;
    const data = new FormData(event.currentTarget);
    setSubmittedKind(kind);
    startTransition(() => formAction(data));
  }

  const showErrors = state.status === "error" && submittedKind === kind;
  const errorOf = (name: string) => (showErrors ? state.fieldErrors?.[name as CampoAnotar] : undefined);
  const errorId = (name: string) => `cn-anotar-${name}-error`;
  const describe = (name: string) => (errorOf(name) ? { "aria-invalid": true, "aria-describedby": errorId(name) } : {});
  const noBalance = noBalanceNotice(options, originName(kind) ? draft.origin : undefined, draft.amount);

  // Plain render helpers (not components): a component defined here would be a
  // new type on every render and remount its uncontrolled select.
  function fieldError(name: string) {
    const message = errorOf(name);
    return message ? (
      <span id={errorId(name)} className={cnQuickEntryRecipes.fieldError}>
        {message}
      </span>
    ) : null;
  }

  function selectField(index: 0 | 1) {
    const field = fields[index];
    const isOrigin = field.name === originName(kind);
    return (
      // Keyed by kind: switching type remounts the select with its own default.
      <label key={`${kind}-${index}`} className={cnQuickEntryRecipes.field}>
        {field.label}
        <select
          name={field.name}
          required
          defaultValue={initialValue(field.name, field.options)}
          onChange={isOrigin ? (event) => setDraft((current) => ({ ...current, origin: event.target.value })) : undefined}
          className={cnQuickEntryRecipes.control}
          {...describe(field.name)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldError(field.name)}
      </label>
    );
  }

  return (
    <section ref={ref} id="cn-anotar" aria-label="Anotar rápido" className={cnQuickEntryRecipes.panel}>
      <form onSubmit={onSubmit} aria-busy={pending} className="contents">
        <input type="hidden" name="tipo" value={kind} />
        <input ref={keyInputRef} type="hidden" name="operationKey" defaultValue="" />
        <div role="group" aria-label="Tipo de movimiento" className={cnQuickEntryRecipes.kinds}>
          {QUICK_ENTRY_KINDS.map((def) => (
            <button
              key={def.kind}
              type="button"
              aria-pressed={def.kind === kind}
              disabled={pending}
              onClick={() => chooseKind(def.kind)}
              className={cnQuickEntryRecipes.kind}
            >
              <span
                aria-hidden="true"
                className={[cnQuickEntryRecipes.kindDot, def.identity ? DOT[def.identity] : cnIdentityRecipes.dotNeutral].join(" ")}
              />
              {def.label}
            </button>
          ))}
        </div>

        <div className={cnQuickEntryRecipes.fields}>
          {selectField(0)}
          <label className={cnQuickEntryRecipes.field}>
            Monto
            <input
              name="monto"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              placeholder="$ 0"
              defaultValue={prefill?.monto ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              className={cnQuickEntryRecipes.amount}
              {...describe("monto")}
            />
            {fieldError("monto")}
          </label>
          {selectField(1)}
          <label className={cnQuickEntryRecipes.field}>
            Fecha
            <input
              name="fecha"
              type="date"
              required
              max={defaultDate}
              defaultValue={defaultDate}
              className={cnQuickEntryRecipes.control}
              {...describe("fecha")}
            />
            {fieldError("fecha")}
          </label>
        </div>

        {noBalance ? <Notice level="problema">{noBalance}</Notice> : null}
        {showErrors && state.message ? (
          <div role="alert">
            <Notice level="problema">{state.message}</Notice>
          </div>
        ) : null}

        <div className={cnQuickEntryRecipes.footer}>
          <button type="button" onClick={onClose} className={cnQuickEntryRecipes.close}>
            Cerrar
          </button>
          <button type="submit" disabled={!action || pending} aria-disabled={!action || pending} className={cnQuickEntryRecipes.save}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </section>
  );
});
