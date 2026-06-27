import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Hash,
  Landmark,
  Percent,
  UserRound,
  WalletCards,
} from "lucide-react";

import { obtenerCreditoDetalle } from "@/features/creditos/queries";
import {
  formatCurrencyCOP,
  formatDateCO,
  formatPercent,
} from "@/lib/formatters";

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
  const plazoMeses = Number(credito.plazoMeses);

  const saldoActual = credito.eventos.reduce((saldo, evento) => {
    if (evento.saldoCapitalPost === null) {
      return saldo;
    }

    return Number(evento.saldoCapitalPost);
  }, monto);

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50 via-white to-white px-6 py-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-sm font-semibold text-violet-700">
                  <Hash className="h-3.5 w-3.5" />
                  {credito.codigo}
                </span>

                <EstadoCreditoBadge estado={credito.estado} />
              </div>

              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                {credito.cliente.nombre}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Crédito creado el {formatDateCO(credito.creadoEn)}
              </p>
            </div>

            <Link
              href="/creditos"
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a créditos
            </Link>
          </div>
        </div>

        <section className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            icon={Landmark}
            label="Monto"
            value={formatCurrencyCOP(monto)}
            className="xl:col-span-2"
          />

          <MetricCard
            icon={WalletCards}
            label="Saldo"
            value={formatCurrencyCOP(saldoActual)}
            className="xl:col-span-2"
            featured
          />

          <MetricCard
            icon={Percent}
            label="Tasa mensual"
            value={formatPercent(tasaMensual)}
          />

          <MetricCard
            icon={Clock3}
            label="Plazo"
            value={`${formatPlainNumber(plazoMeses)} meses`}
          />

          <MetricCard
            icon={CalendarDays}
            label="Fecha préstamo"
            value={formatDateCO(credito.fechaPrestamo)}
            className="xl:col-span-2"
          />

          <MetricCard
            icon={CreditCard}
            label="Frecuencia"
            value={formatFrecuencia(credito.frecuencia)}
            className="xl:col-span-2"
          />

          <MetricCard
            icon={CreditCard}
            label="Tipo"
            value={formatTipoAmortizacion(credito.tipoAmortizacion)}
            className="xl:col-span-2"
          />
        </section>
      </header>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <UserRound className="h-5 w-5" />
          </div>

          <h3 className="text-lg font-semibold text-slate-950">Cliente</h3>
        </div>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <InfoItem label="Nombre" value={credito.cliente.nombre} />
          <InfoItem label="Cédula" value={credito.cliente.cedula} />
          <InfoItem label="Teléfono" value={credito.cliente.telefono || "-"} />
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Cronograma
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Cuotas programadas del crédito.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-800">
            <CalendarDays className="h-4 w-4" />
            {credito.eventos.length} cuota(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Interés</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {credito.eventos.map((evento) => (
                <tr key={evento.id} className="transition hover:bg-violet-50/40">
                  <TableCell className="font-semibold text-slate-950">
                    {evento.numeroCuota ?? "-"}
                  </TableCell>

                  <TableCell>{formatDateCO(evento.fechaProgramada)}</TableCell>

                  <TableCell className="text-right">
                    {formatCurrencyCOP(Number(evento.capitalProgramado))}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrencyCOP(Number(evento.interesProgramado))}
                  </TableCell>

                  <TableCell className="text-right font-bold text-slate-950">
                    {formatCurrencyCOP(Number(evento.valorProgramado))}
                  </TableCell>

                  <TableCell className="text-right">
                    {formatCurrencyCOP(
                      evento.saldoCapitalPost
                        ? Number(evento.saldoCapitalPost)
                        : 0,
                    )}
                  </TableCell>

                  <TableCell>
                    <EstadoEventoBadge estado={evento.estado} />
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  featured?: boolean;
  className?: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  featured,
  className = "",
}: MetricCardProps) {
  return (
    <article
      className={[
        "rounded-2xl border p-4",
        featured
          ? "border-violet-200 bg-violet-50"
          : "border-slate-200 bg-slate-50",
        className,
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
          "mt-2 text-xl font-bold tracking-tight",
          featured ? "text-violet-950" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
    </article>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
}

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return (
    <td className={`whitespace-nowrap px-5 py-4 text-slate-700 ${className}`}>
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
      className={`whitespace-nowrap px-5 py-4 text-left font-semibold ${className}`}
    >
      {children}
    </th>
  );
}

function EstadoCreditoBadge({ estado }: { estado: string }) {
  if (estado === "ACTIVO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Activo
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
      {formatEnumLabel(estado)}
    </span>
  );
}

function EstadoEventoBadge({ estado }: { estado: string }) {
  if (estado === "PENDIENTE") {
    return (
      <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
        Pendiente
      </span>
    );
  }

  if (estado === "PAGADO") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Pagado
      </span>
    );
  }

  if (estado === "ATRASADO" || estado === "MORA") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        {formatEnumLabel(estado)}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {formatEnumLabel(estado)}
    </span>
  );
}

function formatFrecuencia(value: string): string {
  if (value === "MENSUAL") {
    return "Mensual";
  }

  if (value === "QUINCENAL_5_20") {
    return "Quincenal 5/20";
  }

  if (value === "QUINCENAL_10_25") {
    return "Quincenal 10/25";
  }

  if (value === "QUINCENAL_15_30") {
    return "Quincenal 15/30";
  }

  return formatEnumLabel(value);
}

function formatTipoAmortizacion(value: string): string {
  if (value === "AMORTIZACION_FIJA") {
    return "Amortización fija";
  }

  if (value === "SOLO_INTERES") {
    return "Solo interés";
  }

  return formatEnumLabel(value);
}

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlainNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("es-CO", {
        maximumFractionDigits: 2,
      });
}
