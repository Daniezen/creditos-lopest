"use client";

import { useCallback } from "react";
import { Chart, ChartEmptyState, type ChartTheme } from "@/design-system";
import type { ProyeccionMes } from "../queries";
import { buildMonthlySplitOption } from "./monthly-split-option";

const LABELS = { capital: "Capital Esperado", interes: "Interés Esperado" } as const;

/**
 * Expected capital and interest per upcoming month. The scroll canvas is
 * anchored at the start so the nearest months are the first ones visible.
 */
export function ProyeccionChart({ data }: { data: ProyeccionMes[] }) {
  const option = useCallback(
    (theme: ChartTheme) => buildMonthlySplitOption(data, LABELS, "projected", theme),
    [data],
  );

  if (data.length === 0) {
    return <ChartEmptyState message="No hay datos de proyección futuros." />;
  }

  return (
    <Chart
      option={option}
      height="regular"
      label="Proyección mensual de capital e interés esperados"
      scroll={{ categories: data.length, anchor: "start" }}
    />
  );
}
