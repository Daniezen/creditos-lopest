"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilLine, X } from "lucide-react";

import { actualizarFechaPagoCuota } from "../actions";
import type { UpdatePaymentDateState } from "../payment-date-state";

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
            ? "relative min-w-0 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2"
            : "relative w-full min-w-0"
        }
      >
        {compact ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Fecha real
          </p>
        ) : null}

        <span
          className={[
            "block whitespace-nowrap font-semibold text-slate-900",
            compact ? "mt-1 text-xs" : "text-sm",
          ].join(" ")}
        >
          {formattedDate}
        </span>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className={[
            "absolute z-40 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-violet-100 bg-white text-violet-700 shadow-md shadow-slate-900/10 transition hover:bg-violet-50",
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
          ? "relative min-w-0 rounded-2xl border border-violet-200 bg-white/80 px-3 py-2"
          : "relative w-full min-w-0"
      }
    >
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="creditoId" value={creditoId} />

      {compact ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
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
          "block w-full min-w-0 max-w-full whitespace-nowrap border-0 bg-transparent p-0 font-semibold text-slate-900 outline-none disabled:opacity-60",
          compact ? "mt-1 h-5 text-xs" : "h-5 text-xs",
        ].join(" ")}
      />

      <div
        className={[
          "absolute z-50 flex gap-1 rounded-xl border border-violet-100 bg-white p-1.5 shadow-lg shadow-slate-900/15",
          compact
            ? "right-2 top-full mt-1"
            : "left-full top-1/2 ml-1 -translate-y-1/2",
        ].join(" ")}
      >
        {!state.ok ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          aria-label={state.ok ? "Cerrar edición" : "Cancelar edición"}
          title={state.ok ? "Cerrar" : "Cancelar"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {pending || state.message ? (
        <div
          className={[
            "absolute z-50 w-max max-w-[250px] rounded-xl border border-violet-100 bg-white px-3 py-2 shadow-lg shadow-slate-900/15",
            compact
              ? "right-2 top-[calc(100%+3rem)]"
              : "left-full top-[calc(50%+2.35rem)] ml-1",
          ].join(" ")}
        >
          <p
            className={
              pending
                ? "text-xs text-slate-500"
                : state.ok
                  ? "text-xs font-semibold text-emerald-700"
                  : "text-xs font-semibold text-red-700"
            }
          >
            {pending ? "Guardando..." : state.message}
          </p>
        </div>
      ) : null}
    </form>
  );
}
