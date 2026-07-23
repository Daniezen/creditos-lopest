"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { reversarAbonoCapital } from "../reversal-actions";

interface AbonoReversalButtonProps {
  creditoId: string;
  abonoEventoId: string;
}

/** Fixed overlay prevents the confirmation UI from changing table geometry. */
export function AbonoReversalButton({
  creditoId,
  abonoEventoId,
}: AbonoReversalButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
      >
        Revertir
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="revertir-abono-title"
                className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="revertir-abono-title" className="text-lg font-semibold text-slate-950">
                      Revertir abono
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Se restaurara el credito al estado anterior a este abono.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Cerrar confirmacion"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form action={reversarAbonoCapital} className="mt-5">
                  <input type="hidden" name="creditoId" value={creditoId} />
                  <input type="hidden" name="abonoEventoId" value={abonoEventoId} />
                  <label className="block text-sm font-medium text-slate-700">
                    Motivo opcional
                  </label>
                  <textarea
                    name="motivo"
                    maxLength={500}
                    rows={3}
                    className="mt-2 w-full resize-y rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                  />
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Confirmar reversion
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
