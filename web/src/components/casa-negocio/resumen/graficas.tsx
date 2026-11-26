"use client";

import { useCallback } from "react";

import { Chart, type ChartTheme } from "@/design-system";
import type { CobrosVista, GananciaVista } from "@/server/casa-negocio/vista-resumen";

import { opcionCobros, opcionGanancia } from "./opciones";

/**
 * Client islands of the Resumen tab: only the ECharts drawings. Each one
 * scrolls sideways on a phone (one category slot per month), anchored on the
 * latest month, and carries a spoken label; the full text reading and the
 * data table live next to it in the server-rendered section.
 */
export function GraficaGanancia({ vista, label }: { vista: GananciaVista; label: string }) {
  const option = useCallback((theme: ChartTheme) => opcionGanancia(vista, theme), [vista]);
  return (
    <Chart
      option={option}
      height="regular"
      label={label}
      palette="casa-negocio"
      scroll={{ categories: vista.meses.length, anchor: "end" }}
    />
  );
}

export function GraficaCobros({ vista, label }: { vista: CobrosVista; label: string }) {
  const option = useCallback((theme: ChartTheme) => opcionCobros(vista, theme), [vista]);
  return (
    <Chart
      option={option}
      height="regular"
      label={label}
      palette="casa-negocio"
      // Anchored at the start of the future would hide history on a phone;
      // the end shows HOY and what comes, the history is one swipe away.
      scroll={{ categories: vista.meses.length, anchor: "end" }}
    />
  );
}
