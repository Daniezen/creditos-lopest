"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { toDateInputValue } from "@/lib/formatters";
import { registrarAbonoCapital } from "../actions";
import { initialAbonoFormState } from "../abono-state";

interface AbonoFormProps {
  creditoId: string;
  /** `credito.actualizadoEn.toISOString()` as rendered (optimistic lock). */
  creditoVersion: string;
  fechaPrestamo: Date;
  todayValue: string;
}

/**
 * Interactive client form for extraordinary principal prepayments.
 *
 * Uses useActionState to display inline feedback without triggering fatal
 * Next.js error boundaries on validation errors, and enforces HTML5 constraints.
 */
export function AbonoForm({
  creditoId,
  creditoVersion,
  fechaPrestamo,
  todayValue,
}: AbonoFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    registrarAbonoCapital,
    initialAbonoFormState,
  );

  // One idempotency key per logical abono. It is created lazily on the first
  // submit (not during render, which would differ between server and client)
  // and reused by every resubmission until one succeeds, so a double click or
  // a retry after a lost response is recognised by the server as the same
  // abono instead of being applied twice.
  const operationKeyRef = useRef<string | null>(null);
  const submit = (formData: FormData) => {
    operationKeyRef.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", operationKeyRef.current);
    formAction(formData);
  };

  const minDateValue = toDateInputValue(new Date(fechaPrestamo));

  useEffect(() => {
    if (state.ok) {
      // The abono is done: the next one is a different operation.
      operationKeyRef.current = null;
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <form
        ref={formRef}
        action={submit}
        className="flex w-full flex-col gap-2 sm:min-w-[22.5rem] sm:flex-row sm:items-end"
      >
        <input type="hidden" name="creditoId" value={creditoId} />
        <input type="hidden" name="creditoVersion" value={creditoVersion} />

        <label className="min-w-0 flex-1">
          <span className={formRecipes.label}>Fecha del abono</span>
          <input
            type="date"
            name="fechaAbono"
            defaultValue={todayValue}
            max={todayValue}
            min={minDateValue}
            required
            disabled={pending}
            className={formRecipes.control}
          />
        </label>

        <label className="min-w-0 flex-1">
          <span className={formRecipes.label}>Valor del abono</span>
          <input
            type="text"
            name="montoAbono"
            inputMode="numeric"
            placeholder="Ej: 100.000"
            required
            disabled={pending}
            className={formRecipes.control}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className={actionRecipes.primary}
        >
          {pending ? "Aplicando..." : "Aplicar abono"}
        </button>
      </form>

      {state.message ? (
        <p
          role="status"
          className={
            state.ok
              ? "text-xs font-[var(--font-weight-label)] text-[var(--color-success)]"
              : "text-xs font-[var(--font-weight-label)] text-[var(--color-danger)]"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
