import type { ReactNode } from "react";

import type { CuotaSimulada } from "@/domain/creditos/simulador/tipos";

import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

interface SimulatorScheduleProps {
  cronograma: CuotaSimulada[];
}

/**
 * Cronograma visual.
 *
 * Desktop:
 * - Tabla tradicional.
 *
 * Móvil/tablet:
 * - Cards por cuota para evitar scroll horizontal destructivo.
 */
export function SimulatorSchedule({ cronograma }: SimulatorScheduleProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Cronograma simulado
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Esta tabla no representa pagos reales, abonos ni mora persistida. Es
            una proyección financiera.
          </p>
        </div>

        <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800">
          {cronograma.length} cuota(s)
        </div>
      </div>

      <div className="hidden min-w-0 overflow-x-auto lg:block">
        <table className="min-w-[920px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <TableHead>N°</TableHead>
              <TableHead>Fecha programada</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Valor cuota</TableHead>
              <TableHead className="text-right">Saldo capital</TableHead>
              <TableHead>Estado proyectado</TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {cronograma.map((cuota) => (
              <tr
                key={cuota.numeroCuota}
                className="transition hover:bg-violet-50/40"
              >
                <TableCell>{cuota.numeroCuota}</TableCell>

                <TableCell>{formatDateCO(cuota.fechaProgramada)}</TableCell>

                <TableCell className="text-right">
                  {formatCurrencyCOP(cuota.capitalProgramado)}
                </TableCell>

                <TableCell className="text-right">
                  {formatCurrencyCOP(cuota.interesProgramado)}
                </TableCell>

                <TableCell className="text-right font-semibold text-slate-950">
                  {formatCurrencyCOP(cuota.valorCuota)}
                </TableCell>

                <TableCell className="text-right">
                  {formatCurrencyCOP(cuota.saldoCapitalPost)}
                </TableCell>

                <TableCell>
                  <EstadoBadge estado={cuota.estado} />
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {cronograma.map((cuota) => (
          <article
            key={cuota.numeroCuota}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Cuota
                </p>
                <p className="mt-1 text-lg font-bold text-slate-950">
                  #{cuota.numeroCuota}
                </p>
              </div>

              <EstadoBadge estado={cuota.estado} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MobileMetric label="Fecha">
                {formatDateCO(cuota.fechaProgramada)}
              </MobileMetric>

              <MobileMetric label="Valor cuota">
                {formatCurrencyCOP(cuota.valorCuota)}
              </MobileMetric>

              <MobileMetric label="Capital">
                {formatCurrencyCOP(cuota.capitalProgramado)}
              </MobileMetric>

              <MobileMetric label="Interés">
                {formatCurrencyCOP(cuota.interesProgramado)}
              </MobileMetric>

              <MobileMetric label="Saldo capital">
                {formatCurrencyCOP(cuota.saldoCapitalPost)}
              </MobileMetric>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

interface TableCellProps {
  className?: string;
  children: ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 text-slate-700 ${className}`}>
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
      className={`whitespace-nowrap px-4 py-3 text-left font-semibold ${className}`}
    >
      {children}
    </th>
  );
}

interface MobileMetricProps {
  label: string;
  children: ReactNode;
}

function MobileMetric({ label, children }: MobileMetricProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={[
        "rounded-full px-2 py-1 text-xs font-semibold",
        estado === "Atrasado"
          ? "bg-red-100 text-red-700"
          : "bg-violet-100 text-violet-700",
      ].join(" ")}
    >
      {estado}
    </span>
  );
}