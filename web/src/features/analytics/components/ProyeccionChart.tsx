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
import type { ProyeccionMes } from "../queries";

export function ProyeccionChart({ data }: { data: ProyeccionMes[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => {
      const date = new Date(d.mes);
      return {
        ...d,
        label: date.toLocaleDateString("es-CO", { month: "short", year: "numeric" }),
      };
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <p className="text-sm text-slate-500">No hay datos de proyección futura.</p>
      </div>
    );
  }

  // La proyección fluye hacia la derecha. No necesitamos reverse-row.
  const minWidth = Math.max(chartData.length * 60, 600);

  return (
    <div className="w-full">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Proyección de Cartera</h3>
      
      <div className="flex w-full overflow-x-auto pb-4">
        <div style={{ minWidth: `${minWidth}px`, width: "100%", height: "400px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                tickFormatter={(value) => {
                  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
                  return `$${value}`;
                }}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                dx={-10}
              />
              <Tooltip 
                formatter={(value: any) => formatCurrencyCOP(Number(value))}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey="capital" name="Capital Esperado" stackId="a" fill="#818cf8" radius={[0, 0, 4, 4]} />
              <Bar dataKey="interes" name="Interés Esperado" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
