
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
  WalletCards,
} from "lucide-react";

import {
  registrarPagoCuota,
  reversarPagoCuota,
} from "@/features/creditos/pagos/actions";
import { extenderPlazoSoloInteres } from "@/features/creditos/plazos/actions";
import { registrarAbonoCapital } from "@/features/creditos/abonos/actions";
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

/**
 * Detalle de crédito.
 *
 * La tabla de cuotas se alinea con la hoja legacy de Sheets:
 * - número de cuota;
 * - fecha programada;
 * - fecha real de pago;
 * - valor de cuota;
 * - interés;
 * - saldo capital después del pago;
 * - estado;
 * - check de pagado.
 *
 * El check no muta estado localmente: dispara server actions transaccionales.
 */
export default async function CreditoDetallePage({
  params,
}: CreditoDetallePageProps) {
  const { id } = await params;
  const credito = await obtenerCreditoDetalle(id);

  if (!credito) {
    notFound();
  }

  const cuotas = credito.eventos.filter(
    (evento) => evento.tipo === "CUOTA_PROGRAMADA",
  );

  const monto = Number(credito.monto);
  const tasaMensual = Number(credito.tasaMensual);
  const plazoMeses = Number(credito.plazoMeses);

  const saldoActual = cuotas.reduce((saldo, evento) => {
    if (evento.saldoCapitalPost === null) {
      return saldo;
    }

    return Number(evento.saldoCapitalPost);
  }, monto);

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white px-6 py-5">
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
                C.C. {credito.cliente.cedula} · Tel. {credito.cliente.telefono || "-"} · Crédito creado el {formatDateCO(credito.creadoEn)}
              </p>
            </div>

            <Link
              href="/creditos"
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
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


      <section className="mb-5 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Abono extraordinario a capital
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              En amortización fija reduce plazo atacando cuotas futuras desde la cola. En solo interés reduce la base de capital y recalcula intereses futuros.
            </p>
          </div>

          <form action={registrarAbonoCapital} className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[360px] sm:flex-row sm:items-end">
            <input type="hidden" name="creditoId" value={credito.id} />

            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Valor del abono
              </span>
              <input
                name="montoAbono"
                placeholder="Ej: 100.000"
                className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
              />
            </label>

            <button
              type="submit"
              className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700"
            >
              Aplicar abono
            </button>
          </form>
        </div>
      </section>


      {credito.tipoAmortizacion === "SOLO_INTERES" ? (
        <section className="mb-5 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950">
                Extender plazo
              </h3>
            </div>

            <form action={extenderPlazoSoloInteres} className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[320px] sm:flex-row sm:items-end">
              <input type="hidden" name="creditoId" value={credito.id} />

              <label className="block min-w-0 flex-1">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Cuotas extra
                </span>
                <input
                  name="cuotasExtra"
                  inputMode="numeric"
                  placeholder="Ej: 2"
                  className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
                />
              </label>

              <button
                type="submit"
                className="rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
              >
                Extender
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Cuotas
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Pagos programados del crédito.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-sm font-bold text-violet-700 shadow-sm">
              <CalendarDays className="h-4 w-4" />
              {cuotas.length} cuota(s)
            </span>
</div>
        </div>

        <div className="md:hidden">
          <div className="divide-y divide-violet-100">
            {cuotas.map((evento) => {
              const estaPagado = evento.estado === "PAGADO";
              const estaAtrasado =
                evento.estado === "ATRASADO" || evento.estado === "MORA";
              const estaCanceladoPorAbono =
                evento.estado === "CANCELADO_POR_ABONO";
              const action = estaPagado ? reversarPagoCuota : registrarPagoCuota;

              const cardClassName = [
                "p-4 transition",
                estaPagado
                  ? "bg-emerald-50/80"
                  : estaAtrasado
                    ? "bg-red-50/80"
                    : estaCanceladoPorAbono
                      ? "bg-slate-50 text-slate-500"
                      : "bg-white",
              ].join(" ");

              return (
                <article key={evento.id} className={cardClassName}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                        Cuota {evento.numeroCuota ?? "-"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCurrencyCOP(Number(evento.valorProgramado))}
                      </p>
                    </div>

                    <form action={action}>
                      <input type="hidden" name="eventoId" value={evento.id} />
                      <input type="hidden" name="creditoId" value={credito.id} />
                      <button
                        type="submit"
                        disabled={estaCanceladoPorAbono}
                        className="inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={estaPagado ? "Reversar pago" : "Registrar pago"}
                      >
                        <span
                          className={[
                            "flex h-6 w-6 items-center justify-center rounded border-2 transition",
                            estaPagado
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-red-400 bg-white text-white",
                          ].join(" ")}
                        >
                          {estaPagado ? <CheckCircle2 className="h-4 w-4" /> : null}
                        </span>
                      </button>
                    </form>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <CompactField
                      label="Fecha programada"
                      value={formatDateCO(evento.fechaProgramada)}
                    />
                    <CompactField
                      label="Fecha real"
                      value={formatDateCO(evento.fechaPago)}
                    />
                    <CompactField
                      label="Intereses"
                      value={formatCurrencyCOP(Number(evento.interesProgramado))}
                    />
                    <CompactField
                      label="Saldo capital"
                      value={formatCurrencyCOP(
                        evento.saldoCapitalPost
                          ? Number(evento.saldoCapitalPost)
                          : 0,
                      )}
                    />
                  </div>

                  <div className="mt-3">
                    <EstadoEventoBadge estado={evento.estado} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[920px] w-full table-fixed divide-y divide-slate-200 text-sm">
            <thead className="bg-violet-50/60 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <TableHead className="w-[90px]">
                  Número<br />de Cuota
                </TableHead>
                <TableHead className="w-[118px]">
                  Fecha<br />Programada
                </TableHead>
                <TableHead className="w-[118px]">
                  Fecha Real<br />de Pago
                </TableHead>
                <TableHead className="w-[110px] text-right">
                  Valor<br />Cuota
                </TableHead>
                <TableHead className="w-[165px] text-right">
                  Parte de la cuota<br />
                  que se convierte<br />
                  en abono a{" "}
                  <span className="font-black text-blue-700">intereses</span>
                </TableHead>
                <TableHead className="w-[145px] text-right">
                  Saldo crédito<br />
                  <span className="font-black text-green-700">(capital)</span><br />
                  después del pago
                </TableHead>
                <TableHead className="w-[105px]">Estado</TableHead>
                <TableHead className="w-[85px] text-center">¿Pagado?</TableHead>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {cuotas.map((evento) => {
                const estaPagado = evento.estado === "PAGADO";
                const estaAtrasado =
                  evento.estado === "ATRASADO" || evento.estado === "MORA";
                const estaCanceladoPorAbono =
                  evento.estado === "CANCELADO_POR_ABONO";
                const action = estaPagado ? reversarPagoCuota : registrarPagoCuota;

                const rowClassName = [
                  "transition",
                  estaPagado
                    ? "bg-emerald-50/80 hover:bg-emerald-50"
                    : estaAtrasado
                      ? "bg-red-50/80 hover:bg-red-50"
                      : estaCanceladoPorAbono
                        ? "bg-slate-50 text-slate-500"
                        : "hover:bg-violet-50/40",
                ].join(" ");

                return (
                  <tr key={evento.id} className={rowClassName}>
                    <TableCell className="font-semibold text-slate-950">
                      {evento.numeroCuota ?? "-"}
                    </TableCell>

                    <TableCell>{formatDateCO(evento.fechaProgramada)}</TableCell>

                    <TableCell>{formatDateCO(evento.fechaPago)}</TableCell>

                    <TableCell className="text-right font-bold text-slate-950">
                      {formatCurrencyCOP(Number(evento.valorProgramado))}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatCurrencyCOP(Number(evento.interesProgramado))}
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

                    <TableCell className="text-center">
                      <form action={action}>
                        <input type="hidden" name="eventoId" value={evento.id} />
                        <input type="hidden" name="creditoId" value={credito.id} />
                        <button
                          type="submit"
                          disabled={estaCanceladoPorAbono}
                          className="inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={estaPagado ? "Reversar pago" : "Registrar pago"}
                        >
                          <span
                            className={[
                              "flex h-6 w-6 items-center justify-center rounded border-2 transition",
                              estaPagado
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-red-400 bg-white text-white",
                            ].join(" ")}
                          >
                            {estaPagado ? <CheckCircle2 className="h-4 w-4" /> : null}
                          </span>
                        </button>
                      </form>
                    </TableCell>
                  </tr>
                );
              })}
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
          : "border-violet-100 bg-white/80",
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

interface CompactFieldProps {
  label: string;
  value: string;
}

function CompactField({ label, value }: CompactFieldProps) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white/80 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-slate-900">{value}</p>
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
      className={`whitespace-normal px-4 py-3 text-left align-middle font-semibold leading-tight ${className}`}
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

  if (estado === "CANCELADO_POR_ABONO") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Cancelado por abono
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
  