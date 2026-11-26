"use client";

import { useCallback } from "react";

import { Chart, ChartEmptyState, type ChartTheme } from "@/design-system";
import { cnAhorroRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import type { BarraAhorro } from "@/server/casa-negocio/vista-ahorro";

import { buildDepositsOption } from "./deposits-option";

/**
 * «Lo que entró cada mes»: the twelve months ending at the one looked at.
 * The chart is an image for assistive technology, so the same numbers are
 * also listed (visually hidden) month by month.
 */
export function DepositsChart({ barras }: { barras: BarraAhorro[] }) {
  const option = useCallback((theme: ChartTheme) => buildDepositsOption(barras, theme), [barras]);
  const vacio = barras.every((b) => b.valor <= 0);

  return (
    <section aria-labelledby="ahorro-meses" className={cnAhorroRecipes.months}>
      <h2 id="ahorro-meses" className={cnAhorroRecipes.monthsTitle}>
        Lo que entró cada mes
      </h2>
      {vacio ? (
        <ChartEmptyState message="Todavía no ha entrado nada al ahorro." />
      ) : (
        <>
          <Chart option={option} height="compact" label="Depósitos al ahorro por mes" palette="casa-negocio" />
          <ul className="sr-only">
            {barras.map((b) => (
              <li key={b.mes}>
                {b.etiqueta}: {b.texto}
                {b.pendiente ? " (por pasar)" : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
