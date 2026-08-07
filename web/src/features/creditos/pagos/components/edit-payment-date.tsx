"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilLine, X } from "lucide-react";

import { actualizarFechaPagoCuota } from "../actions";
import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { overlayRecipes } from "@/design-system/recipes/overlays";
import type { UpdatePaymentDateState } from "../payment-date-state";

import styles from "./edit-payment-date.module.css";

interface EditPaymentDateProps {
  eventoId: string;
  creditoId: string;
  initialDate: string;
  formattedDate: string;
  compact?: boolean;
}

const initialState: UpdatePaymentDateState = {
  ok: false,
  message: null,
};

/**
 * Edits the actual payment date without changing the table row or card size.
 *
 * The date text and native input keep the existing footprint. Edit, confirm,
 * cancel, and feedback controls are absolutely positioned overlays, so they do
 * not participate in layout calculations or reduce the date's available width.
 */
export function EditPaymentDate({
  eventoId,
  creditoId,
  initialDate,
  formattedDate,
  compact = false,
}: EditPaymentDateProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    actualizarFechaPagoCuota,
    initialState,
  );

  function closeEditor() {
    setEditing(false);

    if (state.ok) {
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <div
        className={
          compact
            ? `${dataDisplayRecipes.compactDatum} ${styles.compact}`
            : "relative w-full min-w-0"
        }
      >
        {compact ? (
          <p className={dataDisplayRecipes.compactDatumLabel}>
            Fecha real
          </p>
        ) : null}

        <span
          className={[
            dataDisplayRecipes.numericCell,
            compact ? styles.compactValue : styles.value,
          ].join(" ")}
        >
          {formattedDate}
        </span>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className={[
            `${actionRecipes.entityDetailIcon} ${styles.editButton}`,
            compact
              ? "right-2 top-1/2 -translate-y-1/2"
              : "left-full top-1/2 ml-1 -translate-y-1/2",
          ].join(" ")}
          aria-label="Editar fecha real de pago"
          title="Editar fecha real de pago"
        >
          <PencilLine className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={
        compact
          ? `${dataDisplayRecipes.compactDatum} ${styles.compact}`
          : "relative w-full min-w-0"
      }
    >
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="creditoId" value={creditoId} />

      {compact ? (
        <p className={dataDisplayRecipes.compactDatumLabel}>
          Fecha real
        </p>
      ) : null}

      <input
        type="date"
        name="fechaPago"
        defaultValue={initialDate}
        required
        disabled={pending || state.ok}
        className={[
          formRecipes.control,
          styles.dateInput,
          compact ? styles.compactInput : "",
        ].join(" ")}
      />

      <div
        className={[
          styles.controls,
          compact
            ? "right-2 top-full mt-1"
            : "left-full top-1/2 ml-1 -translate-y-1/2",
        ].join(" ")}
      >
        {!state.ok ? (
          <button
            type="submit"
            disabled={pending}
            className={`${actionRecipes.primary} ${styles.iconAction}`}
            aria-label="Guardar fecha real de pago"
            title="Guardar"
          >
            <Check className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={closeEditor}
          disabled={pending}
          className={`${actionRecipes.secondary} ${styles.iconAction}`}
          aria-label={state.ok ? "Cerrar edición" : "Cancelar edición"}
          title={state.ok ? "Cerrar" : "Cancelar"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {pending || state.message ? (
        <div
          className={[
            `${overlayRecipes.tooltip} ${styles.feedback}`,
            compact
              ? "right-2 top-[calc(100%+3rem)]"
              : "left-full top-[calc(50%+2.35rem)] ml-1",
          ].join(" ")}
        >
          <p
            className={
              pending
                ? styles.feedbackPending
                : state.ok
                  ? styles.feedbackSuccess
                  : styles.feedbackError
            }
          >
            {pending ? "Guardando..." : state.message}
          </p>
        </div>
      ) : null}
    </form>
  );
}
