import type { ComponentType } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Coins,
  CreditCard,
  Hash,
  Landmark,
} from "lucide-react";

import type { ResumenSimulacion } from "@/domain/creditos/simulador/tipos";

import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

interface CreditSummaryCompactProps {
  resumen: ResumenSimulacion;
}

/**
 * Resumen compacto para el paso Crédito.
 *
 * Intención:
 * - mantener el impacto financiero visible;
 * - no empujar el cronograma demasiado abajo;
 * - evitar las tarjetas grandes usadas en el simulador libre.
 */
export function CreditSummaryCompact({ resumen }: CreditSummaryCompactProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryItem
          icon={Landmark}
          label="Capital"
          value={formatCurrencyCOP(resumen.totalCapital)}
        />

        <SummaryItem
          icon={Coins}
          label="Interés"
          value={formatCurrencyCOP(resumen.totalInteres)}
        />

        <SummaryItem
          icon={CreditCard}
          label="Total"
          value={formatCurrencyCOP(resumen.totalPagar)}
          featured
        />

        <SummaryItem
          icon={Hash}
          label="Cuotas"
          value={String(resumen.numeroCuotas)}
        />

        <SummaryItem
          icon={CalendarDays}
          label="Primera"
          value={formatDateCO(resumen.fechaPrimeraCuota)}
        />

        <SummaryItem
          icon={CalendarCheck}
          label="Última"
          value={formatDateCO(resumen.fechaUltimaCuota)}
        />
      </div>
    </section>
  );
}

interface SummaryItemProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  featured?: boolean;
}

function SummaryItem({ icon: Icon, label, value, featured }: SummaryItemProps) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        "border-slate-200 bg-slate-50",
      ].join(" ")}
    >
      <p
        className={[
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
          featured ? "text-violet-700" : "text-slate-500",
        ].join(" ")}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>

      <p
        className={[
          "mt-2 text-lg font-bold tracking-tight",
          featured ? "text-violet-950" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
