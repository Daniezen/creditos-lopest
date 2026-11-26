import type { ReactNode } from "react";
import { CalendarDays, RotateCcw } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

interface SimulatorScheduleRow {
  numeroCuota: number;
  fechaProgramada: Date;
  capitalProgramado: number;
  interesProgramado: number;
  valorCuota: number;
  saldoCapitalPost: number;
}

interface SimulatorScheduleProps {
  cronograma: SimulatorScheduleRow[];

  /**
   * Compatibilidad con consumidores existentes.
   *
   * Algunas vistas todavía pasan showEstado={false}. En esta versión no se
   * renderiza "Estado proyectado" porque, en una simulación nueva, todas las
   * cuotas son proyecciones naturales y esa columna no aporta información real.
   */
  showEstado?: boolean;

  /**
   * Acción opcional para reiniciar la simulación.
   *
   * Solo debe enviarse cuando ya existe una simulación generada.
   */
  onReset?: () => void;
}

/**
 * Cuotas proyectadas del simulador.
 *
 * Decisión responsive:
 * - En móvil se usan tarjetas compactas para evitar scroll horizontal.
 * - En escritorio se mantiene tabla porque permite comparar cuotas de forma
 *   más eficiente.
 *
 * Restricción:
 * - Este componente no persiste datos.
 * - Solo renderiza cuotas calculadas en memoria.
 */
export function SimulatorSchedule({
  cronograma,
  onReset,
}: SimulatorScheduleProps) {
  return (
    <section className={surfaceRecipes.dataPanel}>
      <div className={`${surfaceRecipes.dataPanelHeader} flex flex-col justify-between gap-3 sm:flex-row sm:items-center`}>
        <div>
          <h3 className="text-lg font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
            Cuotas
          </h3>

          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Proyección de pagos según las condiciones ingresadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={statusRecipes.neutral}>
            <CalendarDays className="h-4 w-4" />
            {cronograma.length} cuota(s)
          </span>

          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className={actionRecipes.tertiaryPill}
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 p-3 md:hidden">
        {cronograma.map((cuota) => (
          <QuotaCard
            key={`${cuota.numeroCuota}-${cuota.fechaProgramada.toISOString()}`}
            cuota={cuota}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[720px] w-full divide-y divide-[var(--color-border-subtle)] text-sm">
          <thead className="bg-[var(--color-surface-subtle)] text-xs font-[var(--font-weight-heading)] text-[var(--color-text-secondary)]">
            <tr>
              <TableHead>N°</TableHead>
              <TableHead>Fecha programada</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Valor cuota</TableHead>
              <TableHead className="text-right">Saldo capital</TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {cronograma.map((cuota) => (
              <tr
                key={`${cuota.numeroCuota}-${cuota.fechaProgramada.toISOString()}`}
                className={dataDisplayRecipes.operationalRow}
              >
                <TableCell className="font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
                  {cuota.numeroCuota}
                </TableCell>

                <TableCell>{formatDateCO(cuota.fechaProgramada)}</TableCell>

                <TableCell className="text-right font-[var(--font-weight-data)]">
                  {formatCurrencyCOP(cuota.capitalProgramado)}
                </TableCell>

                <TableCell className="text-right font-[var(--font-weight-data)]">
                  {formatCurrencyCOP(cuota.interesProgramado)}
                </TableCell>

                <TableCell className="text-right font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
                  {formatCurrencyCOP(cuota.valorCuota)}
                </TableCell>

                <TableCell className="text-right font-[var(--font-weight-data)]">
                  {formatCurrencyCOP(cuota.saldoCapitalPost)}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface QuotaCardProps {
  cuota: SimulatorScheduleRow;
}

/**
 * Tarjeta compacta de cuota para móvil.
 *
 * Prioridad visual:
 * 1. número de cuota y fecha;
 * 2. valor de la cuota;
 * 3. capital, interés y saldo como detalles compactos.
 */
function QuotaCard({ cuota }: QuotaCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] px-4 py-3 shadow-[var(--ds-shadow-surface)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={dataDisplayRecipes.eyebrow}>
            Cuota {cuota.numeroCuota}
          </p>

          <p className="mt-1 text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
            {formatDateCO(cuota.fechaProgramada)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
            Valor
          </p>

          <p className="mt-1 text-lg font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
            {formatCurrencyCOP(cuota.valorCuota)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border-subtle)] pt-3">
        <MiniMetric
          label="Capital"
          value={formatCurrencyCOP(cuota.capitalProgramado)}
        />
        <MiniMetric
          label="Interés"
          value={formatCurrencyCOP(cuota.interesProgramado)}
        />
        <MiniMetric
          label="Saldo"
          value={formatCurrencyCOP(cuota.saldoCapitalPost)}
        />
      </div>
    </article>
  );
}

interface MiniMetricProps {
  label: string;
  value: string;
}

function MiniMetric({ label, value }: MiniMetricProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-[var(--font-weight-data-emphasis)] text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return (
    <td className={`${dataDisplayRecipes.tableCell} ${className}`}>
      {children}
    </td>
  );
}

interface TableHeadProps {
  className?: string;
  children: ReactNode;
}

function TableHead({ className = "", children }: TableHeadProps) {
  return (
    <th
      className={`${dataDisplayRecipes.tableHead} ${className}`}
    >
      {children}
    </th>
  );
}

