import type { ReactNode } from "react";
import { CalendarDays, RotateCcw } from "lucide-react";

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
    <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-950">
            Cuotas
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Proyección de pagos según las condiciones ingresadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-sm font-bold text-violet-700 shadow-sm">
            <CalendarDays className="h-4 w-4" />
            {cronograma.length} cuota(s)
          </span>

          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-sm font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
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
        <table className="min-w-[720px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-violet-50/45 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <TableHead>N°</TableHead>
              <TableHead>Fecha programada</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Valor cuota</TableHead>
              <TableHead className="text-right">Saldo capital</TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {cronograma.map((cuota) => (
              <tr
                key={`${cuota.numeroCuota}-${cuota.fechaProgramada.toISOString()}`}
                className="transition hover:bg-violet-50/45"
              >
                <TableCell className="font-semibold text-slate-950">
                  {cuota.numeroCuota}
                </TableCell>

                <TableCell>{formatDateCO(cuota.fechaProgramada)}</TableCell>

                <TableCell className="text-right">
                  {formatCurrencyCOP(cuota.capitalProgramado)}
                </TableCell>

                <TableCell className="text-right">
                  {formatCurrencyCOP(cuota.interesProgramado)}
                </TableCell>

                <TableCell className="text-right font-bold text-slate-950">
                  {formatCurrencyCOP(cuota.valorCuota)}
                </TableCell>

                <TableCell className="text-right">
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
    <article className="rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-sm shadow-violet-100/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
            Cuota {cuota.numeroCuota}
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-600">
            {formatDateCO(cuota.fechaProgramada)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Valor
          </p>

          <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
            {formatCurrencyCOP(cuota.valorCuota)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-violet-50 pt-3">
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
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-bold text-slate-700">
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
    <td className={`whitespace-nowrap px-5 py-3.5 text-slate-700 ${className}`}>
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
      className={`whitespace-nowrap px-5 py-3 text-left font-black ${className}`}
    >
      {children}
    </th>
  );
}
