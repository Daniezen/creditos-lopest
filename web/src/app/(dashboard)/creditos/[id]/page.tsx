
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
  PencilLine,
  WalletCards,
  Activity,
  StickyNote,
} from "lucide-react";

import { extenderPlazoSoloInteres } from "@/features/creditos/plazos/actions";
import { registrarAbonoCapital } from "@/features/creditos/abonos/actions";
import { CreditMovements } from "@/features/creditos/components/credit-movements";
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

  const monto = Number(credito.monto);
  const tasaMensual = Number(credito.tasaMensual);
  const plazoMeses = Number(credito.plazoMeses);

  // The current balance must come from the latest effective paid event, not
  // from the final projected installment. In Solo Interés schedules, the last
  // future installment legitimately projects saldoCapitalPost = 0.
  const ultimoEventoPagadoConSaldo = [...credito.eventos]
    .filter(
      (evento) =>
        evento.estado === "PAGADO" && evento.saldoCapitalPost !== null,
    )
    .sort((a, b) => {
      const fechaA = a.fechaPago ?? a.fechaProgramada;
      const fechaB = b.fechaPago ?? b.fechaProgramada;
      return fechaB.getTime() - fechaA.getTime();
    })[0];

  const saldoActual = ultimoEventoPagadoConSaldo
    ? Number(ultimoEventoPagadoConSaldo.saldoCapitalPost)
    : monto;

  const cuotasEfectivas = credito.eventos.filter(
    (evento) =>
      evento.tipo === "CUOTA_PROGRAMADA" &&
      evento.estado !== "CANCELADO_POR_ABONO",
  );
  const cuotasPagadas = cuotasEfectivas.filter(
    (evento) => evento.estado === "PAGADO",
  ).length;
  const tieneMora = cuotasEfectivas.some((evento) => evento.estado === "MORA");
  const tieneAtraso = cuotasEfectivas.some(
    (evento) => evento.estado === "ATRASADO",
  );
  const estadoOperativo = tieneMora
    ? "En mora"
    : tieneAtraso
      ? "Atrasado"
      : credito.estado === "CANCELADO"
        ? "Pagado"
        : "Al día";
  const observacionOperativa =
    "Pagado: " +
    cuotasPagadas +
    "/" +
    cuotasEfectivas.length +
    " · Saldo: " +
    formatCurrencyCOP(saldoActual) +
    " · " +
    estadoOperativo;

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

                        <div className="flex flex-wrap gap-2">
              <Link
                href={`/creditos/${credito.id}/editar`}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <PencilLine className="h-4 w-4" />
                Editar crédito
              </Link>

<Link
              href="/creditos"
              className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
            </div>
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

        <section className="grid gap-3 border-t border-violet-100 px-5 pb-5 pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <OperationalInfo
            icon={Activity}
            label="Observación operativa"
            value={observacionOperativa}
          />
          <OperationalInfo
            icon={StickyNote}
            label="Nota"
            value={credito.nota?.trim() || "Sin nota registrada"}
            muted={!credito.nota?.trim()}
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

      <CreditMovements
        creditoId={credito.id}
        montoInicial={monto}
        eventos={credito.eventos}
      />
    </main>
  );
}

interface OperationalInfoProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}

function OperationalInfo({
  icon: Icon,
  label,
  value,
  muted = false,
}: OperationalInfoProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-violet-100 bg-violet-50/35 px-4 py-3">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-violet-600" />
        {label}
      </p>
      <p
        className={[
          "mt-1.5 line-clamp-2 text-sm leading-5",
          muted ? "text-slate-400" : "font-medium text-slate-800",
        ].join(" ")}
        title={value}
      >
        {value}
      </p>
    </article>
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
  