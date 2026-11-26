import type { ComponentType } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Coins,
  CreditCard,
  Hash,
  Landmark,
} from "lucide-react";

import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
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
 * Tarjeta compacta de métrica con densidad visual estandarizada.
 */
function SummaryCard({ icon: Icon, label, value, featured }: SummaryCardProps) {
  return (
    <div className={dataDisplayRecipes.metricCompact}>
      <p className={dataDisplayRecipes.metricCompactLabel}>
        <Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)] shrink-0" />
        <span>{label}</span>
      </p>

      <p
        className={[
          dataDisplayRecipes.metricCompactValue,
          featured ? "font-[var(--font-weight-heading)] text-[var(--color-selection-strong)]" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

