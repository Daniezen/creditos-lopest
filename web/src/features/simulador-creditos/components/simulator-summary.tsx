import {
  CalendarCheck,
  CalendarDays,
  Coins,
  CreditCard,
  Hash,
  Landmark,
} from "lucide-react";

import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

import type { ResumenSimulacion } from "@/domain/creditos/simulador/tipos";

interface SimulatorSummaryProps {
  resumen: ResumenSimulacion;
}

export function SimulatorSummary({ resumen }: SimulatorSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard
        icon={Landmark}
        label="Total capital"
        value={formatCurrencyCOP(resumen.totalCapital)}
      />

      <SummaryCard
        icon={Coins}
        label="Total interés"
        value={formatCurrencyCOP(resumen.totalInteres)}
      />

      <SummaryCard
        icon={CreditCard}
        label="Total a pagar"
        value={formatCurrencyCOP(resumen.totalPagar)}
        featured
      />

      <SummaryCard
        icon={Hash}
        label="Número de cuotas"
        value={String(resumen.numeroCuotas)}
      />

      <SummaryCard
        icon={CalendarDays}
        label="Primera cuota"
        value={formatDateCO(resumen.fechaPrimeraCuota)}
      />

      <SummaryCard
        icon={CalendarCheck}
        label="Última cuota"
        value={formatDateCO(resumen.fechaUltimaCuota)}
      />
    </section>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  featured?: boolean;
}

function SummaryCard({ icon: Icon, label, value, featured }: SummaryCardProps) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 shadow-sm",
        featured
          ? "border-violet-200 bg-violet-50"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>

        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            featured
              ? "bg-white text-violet-700 ring-1 ring-violet-200"
              : "bg-violet-50 text-violet-700",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

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