
import Link from "next/link";
import { notFound } from "next/navigation";
import {
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

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { extenderPlazoSoloInteres } from "@/features/creditos/plazos/actions";
import { registrarAbonoCapital } from "@/features/creditos/abonos/actions";
import { CreditMovements } from "@/features/creditos/components/credit-movements";
import { calcularSaldoCapitalActual } from "@/features/creditos/current-capital-balance";
import { obtenerCreditoDetalle } from "@/features/creditos/queries";
import {
  formatCurrencyCOP,
  formatDateCO,
  formatPercent,
} from "@/lib/formatters";

import styles from "./credito-detalle.module.css";

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

  // Derive current balance from every realized principal movement.
  const saldoActual = calcularSaldoCapitalActual(monto, credito.eventos);

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
    <main className={styles.page}>
      <header className={`${surfaceRecipes.dataPanel} ${styles.summary}`}>
        <div className={styles.identityBand}>
          <div className={styles.identityLayout}>
            <div className="min-w-0">
              <div className={styles.identityBadges}>
                <span className={actionRecipes.tertiaryPill}>
                  <Hash className="h-3.5 w-3.5" />
                  {credito.codigo}
                </span>

                <EstadoCreditoBadge estado={credito.estado} />
              </div>

              <h2 className={styles.clientName}>
                {credito.cliente.nombre}
              </h2>

              <p className={styles.identityMeta}>
                C.C. {credito.cliente.cedula} · Tel. {credito.cliente.telefono || "-"} · Crédito creado el {formatDateCO(credito.creadoEn)}
              </p>
            </div>

            <div className={styles.actions}>
              <Link
                href={`/creditos/${credito.id}/editar`}
                className={actionRecipes.primaryLarge}
              >
                <PencilLine className="h-4 w-4" />
                Editar crédito
              </Link>

            </div>
          </div>
        </div>

        <section className={styles.metricsGrid}>
          <MetricCard
            icon={Landmark}
            label="Monto"
            value={formatCurrencyCOP(monto)}
            className="xl:col-span-2"
            emphasis
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
            relevant
          />

          <MetricCard
            icon={Clock3}
            label="Plazo"
            value={`${formatPlainNumber(plazoMeses)} meses`}
            relevant
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

        <section className={styles.operationalGrid}>
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


      <section className={`${surfaceRecipes.section} ${styles.actionSection}`}>
        <div className={styles.actionLayout}>
          <div>
            <h3 className={dataDisplayRecipes.sectionTitle}>
              Abono extraordinario a capital
            </h3>
            <p className={styles.actionHelp}>
              En amortización fija reduce plazo atacando cuotas futuras desde la cola. En solo interés reduce la base de capital y recalcula intereses futuros.
            </p>
          </div>

          <form action={registrarAbonoCapital} className={styles.abonoForm}>
            <input type="hidden" name="creditoId" value={credito.id} />

            <label className={styles.formField}>
              <span className={formRecipes.label}>
                Valor del abono
              </span>
              <input
                name="montoAbono"
                placeholder="Ej: 100.000"
                className={formRecipes.control}
              />
            </label>

            <button
              type="submit"
              className={actionRecipes.primary}
            >
              Aplicar abono
            </button>
          </form>
        </div>
      </section>


      {credito.tipoAmortizacion === "SOLO_INTERES" ? (
        <section className={`${surfaceRecipes.section} ${styles.actionSection}`}>
          <div className={styles.actionLayout}>
            <div>
              <h3 className={dataDisplayRecipes.sectionTitle}>
                Extender plazo
              </h3>
            </div>

            <form action={extenderPlazoSoloInteres} className={styles.extensionForm}>
              <input type="hidden" name="creditoId" value={credito.id} />

              <label className={styles.formField}>
                <span className={formRecipes.label}>
                  Cuotas extra
                </span>
                <input
                  name="cuotasExtra"
                  inputMode="numeric"
                  placeholder="Ej: 2"
                  className={formRecipes.control}
                />
              </label>

              <button
                type="submit"
                className={actionRecipes.secondary}
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
    <article className={`${dataDisplayRecipes.compactDatum} ${styles.operationalInfo}`}>
      <p className={dataDisplayRecipes.compactDatumLabel}>
        <Icon className={styles.semanticIcon} />
        {label}
      </p>
      <p
        className={[
          styles.operationalValue,
          muted ? styles.muted : "",
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
  relevant?: boolean;
  emphasis?: boolean;
  className?: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  featured,
  relevant = false,
  emphasis = false,
  className = "",
}: MetricCardProps) {
  return (
    <article
      className={[
        dataDisplayRecipes.metricCompact,
        featured ? styles.featuredMetric : "",
        className,
      ].join(" ")}
    >
      <p
        className={[
          dataDisplayRecipes.metricCompactLabel,
          featured ? styles.featuredMetricLabel : "",
        ].join(" ")}
      >
        <Icon className={styles.metricIcon} />
        {label}
      </p>

      <p
        className={[
          dataDisplayRecipes.metricCompactValue,
          featured || emphasis
            ? dataDisplayRecipes.metricCompactValueEmphasis
            : relevant
              ? dataDisplayRecipes.metricCompactValueRelevant
              : "",
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
      <span className={statusRecipes.success}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Activo
      </span>
    );
  }

  return (
    <span className={statusRecipes.neutral}>
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
