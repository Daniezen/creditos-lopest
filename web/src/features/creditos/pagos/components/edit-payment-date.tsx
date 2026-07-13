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
 * Edits the actual payment date without changing the layout dimensions.
 *
 * The native date input replaces the rendered date in the same footprint.
 * Confirmation controls are rendered as an absolutely positioned overlay,
 * so they do not participate in table or card layout calculations.
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
            ? "min-w-0 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2"
            : "flex min-w-0 items-center gap-2"
        }
      >
        {compact ? (
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Fecha real
          </p>
        ) : null}

        <div className={compact ? "mt-1 flex min-w-0 items-center gap-2" : "flex min-w-0 items-center gap-2"}>
          <span className="min-w-0 truncate font-semibold text-slate-900">
            {formattedDate}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-100 bg-white text-violet-700 transition hover:bg-violet-50"
            aria-label="Editar fecha real de pago"
            title="Editar fecha real de pago"
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={
        compact
          ? "relative min-w-0 rounded-2xl border border-violet-200 bg-white/80 px-3 py-2"
          : "relative min-w-0"
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
        className={
          compact
            ? "mt-1 block h-7 w-full min-w-0 max-w-full border-0 bg-transparent p-0 text-xs font-semibold text-slate-900 outline-none disabled:opacity-60"
            : "block h-8 w-full min-w-0 max-w-full rounded-xl border border-violet-200 bg-white px-2 text-xs text-slate-950 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 disabled:opacity-60"
        }
      />

      <div
        className={
          compact
            ? "absolute right-0 top-full z-50 mt-1 flex gap-1 rounded-xl border border-violet-100 bg-white p-1.5 shadow-lg shadow-slate-900/15"
            : "absolute left-full top-1/2 z-50 ml-1.5 flex -translate-y-1/2 gap-1 rounded-xl border border-violet-100 bg-white p-1.5 shadow-lg shadow-slate-900/15"
        }
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
          className={
            compact
              ? "absolute right-0 top-[calc(100%+3rem)] z-50 mt-1 max-w-[220px] rounded-xl border border-violet-100 bg-white px-3 py-2 shadow-lg shadow-slate-900/15"
              : "absolute left-full top-[calc(50%+2.4rem)] z-50 ml-1.5 w-max max-w-[260px] rounded-xl border border-violet-100 bg-white px-3 py-2 shadow-lg shadow-slate-900/15"
          }
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
