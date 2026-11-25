"use client";

import { useCallback } from "react";
import { Chart, ChartEmptyState, type ChartTheme } from "@/design-system";
import type { RecaudacionMes } from "../queries";
import { buildMonthlySplitOption } from "./monthly-split-option";

const LABELS = { capital: "Capital Recuperado", interes: "Interés Ganado" } as const;

/**
 * Monthly collected capital and interest. The scroll canvas is anchored at
 * the end so the most recent months are the first ones visible.
 */
export function HistoricoChart({ data }: { data: RecaudacionMes[] }) {
  const option = useCallback(
    (theme: ChartTheme) => buildMonthlySplitOption(data, LABELS, "realized", theme),
    [data],
  );

  if (data.length === 0) {
    return <ChartEmptyState message="No hay datos de recaudación históricos." />;
  }

  return (
    <Chart
      option={option}
      height="regular"
      label="Recaudación mensual histórica de capital e interés"
      scroll={{ categories: data.length, anchor: "end" }}
    />
  );
}
