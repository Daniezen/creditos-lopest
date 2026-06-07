import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

import type { ResumenSimulacion } from "@/domain/creditos/simulador/tipos";

interface SimulatorSummaryProps {
  resumen: ResumenSimulacion;
}

export function SimulatorSummary({ resumen }: SimulatorSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard
        label="Total capital"
        value={formatCurrencyCOP(resumen.totalCapital)}
      />

      <SummaryCard
        label="Total interés"
        value={formatCurrencyCOP(resumen.totalInteres)}
      />

      <SummaryCard
        label="Total a pagar"
        value={formatCurrencyCOP(resumen.totalPagar)}
        featured
      />

      <SummaryCard
        label="Número de cuotas"
        value={String(resumen.numeroCuotas)}
      />

      <SummaryCard
        label="Primera cuota"
        value={formatDateCO(resumen.fechaPrimeraCuota)}
      />

      <SummaryCard
        label="Última cuota"
        value={formatDateCO(resumen.fechaUltimaCuota)}
      />
    </section>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  featured?: boolean;
}

function SummaryCard({ label, value, featured }: SummaryCardProps) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 shadow-sm",
        featured
          ? "border-violet-200 bg-violet-50"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p
        className={[
          "mt-2 text-2xl font-bold tracking-tight",
          featured ? "text-violet-950" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}