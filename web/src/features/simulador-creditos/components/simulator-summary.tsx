import type { ComponentType } from "react";
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

/**
 * Resumen financiero de la simulación.
 *
 * Decisión responsive:
 * - En móvil usa 2 columnas para evitar que cada métrica ocupe todo el ancho.
 * - En desktop usa 3 columnas para mantener lectura financiera rápida.
 *
 * Motivo:
 * - La tabla de cuotas es la sección que más espacio vertical y horizontal
 *   necesita. El resumen debe orientar, no desplazar la tabla demasiado abajo.
 */
export function SimulatorSummary({ resumen }: SimulatorSummaryProps) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
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
        label="N° cuotas"
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
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  featured?: boolean;
}

/**
 * Tarjeta compacta de métrica.
 *
 * Ajuste:
 * - Menor padding en móvil.
 * - Texto de valor ligeramente más pequeño en móvil.
 * - Mantiene jerarquía suficiente en desktop.
 */
function SummaryCard({ icon: Icon, label, value, featured }: SummaryCardProps) {
  return (
    <div
      className={[
        "rounded-[1.5rem] border p-4 shadow-sm shadow-violet-100/40 sm:rounded-[1.75rem] sm:p-5",
        featured
          ? "border-violet-100 bg-gradient-to-br from-white to-violet-50"
          : "border-violet-100 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 text-slate-500 sm:text-sm">
          {label}
        </p>

        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-10 sm:w-10",
            featured
              ? "bg-white text-violet-700 ring-1 ring-violet-100"
              : "bg-violet-100 text-violet-700",
          ].join(" ")}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>

      <p className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:mt-2 sm:text-2xl">
        {value}
      </p>
    </div>
  );
}
