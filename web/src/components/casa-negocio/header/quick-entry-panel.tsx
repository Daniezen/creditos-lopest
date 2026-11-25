"use client";

import { forwardRef, useState } from "react";

import { cnIdentityRecipes, cnQuickEntryRecipes } from "@/design-system/recipes/casa-negocio";

import type { QuickEntryKind, QuickEntryOptions } from "../types";
import { QUICK_ENTRY_KINDS, quickEntryFields } from "./quick-entry";

export interface QuickEntryPanelProps {
  options: QuickEntryOptions;
  /** ISO date (yyyy-mm-dd) the date field starts on: today. */
  defaultDate: string;
  /**
   * Save handler: a server action receiving the form's FormData
   * (`tipo`, the two select names of the type, `monto`, `fecha`).
   * Without one «Guardar» is disabled (demo data).
   */
  action?: (formData: FormData) => void | Promise<void>;
  onClose: () => void;
}

const DOT = {
  casa: cnIdentityRecipes.dotCasa,
  negocio: cnIdentityRecipes.dotNegocio,
  ahorro: cnIdentityRecipes.dotAhorro,
} as const;

/**
 * «Anotar rápido»: the six movement types as a pressed-button group, and the
 * two selects of the chosen type (`quick-entry.ts`), amount and date. The
 * selects remount when the type changes (their key), so a stale choice from
 * another type is never submitted.
 */
export const QuickEntryPanel = forwardRef<HTMLElement, QuickEntryPanelProps>(function QuickEntryPanel(
  { options, defaultDate, action, onClose },
  ref,
) {
  const [kind, setKind] = useState<QuickEntryKind>("gastoCasa");
  const fields = quickEntryFields(kind, options);

  return (
    <section ref={ref} id="cn-anotar" aria-label="Anotar rápido" className={cnQuickEntryRecipes.panel}>
      <form action={action} className="contents">
        <input type="hidden" name="tipo" value={kind} />
        <div role="group" aria-label="Tipo de movimiento" className={cnQuickEntryRecipes.kinds}>
          {QUICK_ENTRY_KINDS.map((def) => (
            <button
              key={def.kind}
              type="button"
              aria-pressed={def.kind === kind}
              onClick={() => setKind(def.kind)}
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
          <label key={`${kind}-a`} className={cnQuickEntryRecipes.field}>
            {fields[0].label}
            <select name={fields[0].name} required className={cnQuickEntryRecipes.control}>
              {fields[0].options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={cnQuickEntryRecipes.field}>
            Monto
            <input
              name="monto"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              placeholder="$ 0"
              className={cnQuickEntryRecipes.amount}
            />
          </label>
          <label key={`${kind}-b`} className={cnQuickEntryRecipes.field}>
            {fields[1].label}
            <select name={fields[1].name} required className={cnQuickEntryRecipes.control}>
              {fields[1].options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={cnQuickEntryRecipes.field}>
            Fecha
            <input name="fecha" type="date" required defaultValue={defaultDate} className={cnQuickEntryRecipes.control} />
          </label>
        </div>

        <div className={cnQuickEntryRecipes.footer}>
          <button type="button" onClick={onClose} className={cnQuickEntryRecipes.close}>
            Cerrar
          </button>
          <button type="submit" disabled={!action} className={cnQuickEntryRecipes.save}>
            Guardar
          </button>
        </div>
      </form>
    </section>
  );
});
