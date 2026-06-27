import Link from "next/link";
import { notFound } from "next/navigation";

import { obtenerCreditoDetalle } from "@/features/creditos/queries";
import { formatCurrencyCOP, formatDateCO, formatPercent } from "@/lib/formatters";

interface CreditoDetallePageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditoDetallePage({
  params,
}: CreditoDetallePageProps) {
  const { id } = await params;
  const credito = await obtenerCreditoDetalle(id);

  if (!credito) {
    notFound();
  }

  const monto = Number(credito.monto);
  const tasaMensual = Number(credito.tasaMensual);

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-center">
        <div>
          <p className="text-sm font-semibold text-violet-700">
            {credito.codigo}
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Crédito de {credito.cliente.nombre}
          </h2>
        </div>

        <Link
          href="/creditos"
          className="w-fit rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
        >
          Volver a créditos
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <Metric label="Monto" value={formatCurrencyCOP(monto)} />
        <Metric label="Tasa mensual" value={formatPercent(tasaMensual)} />
        <Metric label="Plazo" value={`${Number(credito.plazoMeses)} meses`} />
        <Metric label="Estado" value={credito.estado} />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">Cliente</h3>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <p>
            <span className="text-slate-500">Nombre:</span>{" "}
            <span className="font-semibold text-slate-900">
              {credito.cliente.nombre}
            </span>
          </p>

          <p>
            <span className="text-slate-500">Cédula:</span>{" "}
            <span className="font-semibold text-slate-900">
              {credito.cliente.cedula}
            </span>
          </p>

          <p>
            <span className="text-slate-500">Teléfono:</span>{" "}
            <span className="font-semibold text-slate-900">
              {credito.cliente.telefono || "-"}
            </span>
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Cronograma</h3>

          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800">
            {credito.eventos.length} cuota(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Interés</TableHead>
                <TableHead className="text-right">Valor cuota</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {credito.eventos.map((evento) => (
                <tr key={evento.id} className="transition hover:bg-violet-50/40">
                  <TableCell>{evento.numeroCuota ?? "-"}</TableCell>
                  <TableCell>{formatDateCO(evento.fechaProgramada)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyCOP(Number(evento.capitalProgramado))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyCOP(Number(evento.interesProgramado))}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-950">
                    {formatCurrencyCOP(Number(evento.valorProgramado))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyCOP(
                      evento.saldoCapitalPost
                        ? Number(evento.saldoCapitalPost)
                        : 0,
                    )}
                  </TableCell>
                  <TableCell>{evento.estado}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
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
  children: React.ReactNode;
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
