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
  fechaPrestamo,
  todayValue,
}: AbonoFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    registrarAbonoCapital,
    initialAbonoFormState,
  );

  const minDateValue = toDateInputValue(new Date(fechaPrestamo));

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <form
        ref={formRef}
        action={formAction}
        className="flex w-full flex-col gap-2 sm:min-w-[22.5rem] sm:flex-row sm:items-end"
      >
        <input type="hidden" name="creditoId" value={creditoId} />

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
              ? "text-xs font-medium text-[var(--color-success)]"
              : "text-xs font-medium text-[var(--color-danger)]"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
