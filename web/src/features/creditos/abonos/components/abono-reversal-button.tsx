"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { reversarAbonoCapital } from "../reversal-actions";

import styles from "./abono-reversal-button.module.css";

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
        className={styles.trigger}
      >
        Revertir
      </button>

      {open
        ? createPortal(
            <div className={styles.backdrop}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="revertir-abono-title"
                className={`${surfaceRecipes.overlay} ${styles.dialog}`}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <h3 id="revertir-abono-title" className={styles.title}>
                      Revertir abono
                    </h3>
                    <p className={styles.description}>
                      Se restaurara el credito al estado anterior a este abono.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={styles.close}
                    aria-label="Cerrar confirmacion"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form action={reversarAbonoCapital} className={styles.form}>
                  <input type="hidden" name="creditoId" value={creditoId} />
                  <input type="hidden" name="abonoEventoId" value={abonoEventoId} />
                  <label className={formRecipes.label}>
                    Motivo opcional
                  </label>
                  <textarea
                    name="motivo"
                    maxLength={500}
                    rows={3}
                    className={`${formRecipes.control} ${styles.textarea}`}
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className={actionRecipes.secondary}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className={actionRecipes.destructive}
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
