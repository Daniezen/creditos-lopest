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
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
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
    <section className={surfaceRecipes.card}>
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
    <div className={dataDisplayRecipes.metricCompact}>
      <p className={dataDisplayRecipes.metricCompactLabel}>
        <Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)] shrink-0" />
        <span>{label}</span>
      </p>

      <p
        className={[
          dataDisplayRecipes.metricCompactValue,
          featured ? "text-[var(--color-selection-strong)] font-[var(--font-weight-heading)]" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
