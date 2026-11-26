"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrencyCOP } from "@/lib/formatters";
import { parse, format } from "date-fns";
import { es } from "date-fns/locale";
import type { RecaudacionMes } from "../queries";

export function HistoricoChart({ data }: { data: RecaudacionMes[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => {
      // mesStr is YYYY-MM. We parse it at midday to avoid any timezone shifting backwards.
      const date = parse(`${d.mesStr}-01T12:00:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date());
      return {
        ...d,
        label: format(date, "MMM yyyy", { locale: es }),
      };
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
        <p className="text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">No hay datos de recaudación históricos.</p>
      </div>
    );
  }

  const minWidth = Math.max(chartData.length * 60, 600);

  return (
    <div className="w-full">
      <div className="flex w-full overflow-x-auto pb-4" style={{ flexDirection: "row-reverse" }}>
        <div style={{ minWidth: `${minWidth}px`, width: "100%", height: "400px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                dy={10}
                interval={0} 
              />
              <YAxis 
                tickFormatter={(value) => {
                  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
                  return `$${value}`;
                }}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 12 }}
                dx={-10}
              />
              <Tooltip 
                formatter={(value: unknown) => formatCurrencyCOP(Number(value))}
                cursor={{ fill: "var(--color-selection)" }}
                contentStyle={{ borderRadius: "var(--ds-radius-md)", border: "1px solid var(--color-border-default)", backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text-primary)", boxShadow: "var(--ds-shadow-overlay)" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey="capital" name="Capital Recuperado" stackId="a" fill="var(--color-action-primary)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="interes" name="Interés Ganado" stackId="a" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
