import type { ReactNode } from "react";

import type { CuotaSimulada } from "@/domain/creditos/simulador/tipos";

import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

interface SimulatorScheduleProps {
  cronograma: CuotaSimulada[];

  /**
   * Permite ocultar el estado proyectado en pantallas donde no aporta valor.
   * En creación de crédito, antes de guardar, todas las cuotas son solo vista previa.
   */
  showEstado?: boolean;
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
export function SimulatorSchedule({
  cronograma,
  showEstado = true,
}: SimulatorScheduleProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-950">
            Cronograma
          </h3>
        </div>

        <div className="rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-sm font-bold text-violet-700 shadow-sm">
          {cronograma.length} cuota(s)
        </div>
      </div>

      <div className="hidden min-w-0 overflow-x-auto lg:block">
        <table
          className={[
            showEstado ? "min-w-[920px]" : "min-w-[760px]",
            "divide-y divide-slate-200 text-sm",
          ].join(" ")}
        >
          <thead className="bg-violet-50/45 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <TableHead>N°</TableHead>
              <TableHead>Fecha programada</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Interés</TableHead>
              <TableHead className="text-right">Valor cuota</TableHead>
              <TableHead className="text-right">Saldo capital</TableHead>
              {showEstado ? <TableHead>Estado proyectado</TableHead> : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {cronograma.map((cuota) => (
              <tr
                key={cuota.numeroCuota}
                className="transition hover:bg-violet-50/45"
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

                {showEstado ? (
                  <TableCell>
                    {showEstado ? <EstadoBadge estado={cuota.estado} /> : null}
                  </TableCell>
                ) : null}
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