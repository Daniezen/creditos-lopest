"use client";

import {
  CalendarDays,
  ClipboardCheck,
  Coins,
  CreditCard,
  Hash,
  Percent,
  UserRound,
  StickyNote,
} from "lucide-react";

import type { ClienteSelectorOption } from "@/features/clientes/types";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import type {
  SimulationResult,
  SimulatorFormState,
} from "@/features/simulador-creditos/types";

import {
  formatCurrencyCOP,
  formatDateCO,
  formatPercent,
  parseDateInputValue,
  parseNumericInput,
  parseTasaMensualInput,
} from "@/lib/formatters";

interface ConfirmationStepProps {
  cliente: ClienteSelectorOption | null;
  form: SimulatorFormState;
  resultado: SimulationResult;
  nota: string;
  onNotaChange: (value: string) => void;
  error: string | null;
}

export function ConfirmationStep({
  cliente,
  form,
  resultado,
  nota,
  onNotaChange,
  error,
}: ConfirmationStepProps) {
  const monto = parseNumericInput(form.monto);
  const tasaMensual = parseTasaMensualInput(form.tasaMensual);
  const fechaPrestamo = form.fechaPrestamo
    ? parseDateInputValue(form.fechaPrestamo)
    : null;

  return (
    <section className="space-y-6">
      <div className={surfaceRecipes.card}>
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-selection)] text-[var(--color-selection-strong)]">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-lg font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
              Confirmación del crédito
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Al guardar, se abrirá el detalle del crédito creado.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <ReviewCard icon={UserRound} title="Cliente">
            <p className="font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
              {cliente ? cliente.nombre : "Sin cliente"}
            </p>
            <p className="mt-1 text-[var(--color-text-secondary)]">
              {cliente ? `C.C. ${cliente.cedula}` : "-"}
            </p>
          </ReviewCard>

          <ReviewCard icon={CreditCard} title="Condiciones">
            <ReviewLine icon={Coins} label="Monto" value={formatCurrencyCOP(monto)} />
            <ReviewLine icon={Percent} label="Tasa" value={formatPercent(tasaMensual)} />
            <ReviewLine icon={Hash} label="Plazo" value={`${form.plazoMeses || "-"} meses`} />
            <ReviewLine icon={CreditCard} label="Frecuencia" value={form.frecuencia || "-"} />
            <ReviewLine icon={CreditCard} label="Tipo" value={form.tipoAmortizacion || "-"} />
            <ReviewLine
              icon={CalendarDays}
              label="Fecha préstamo"
              value={fechaPrestamo ? formatDateCO(fechaPrestamo) : "-"}
            />
          </ReviewCard>

          <ReviewCard icon={ClipboardCheck} title="Totales" wideOnMedium>
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
              <SummaryDatum
                label="Total capital"
                value={
                  resultado.resumen
                    ? formatCurrencyCOP(resultado.resumen.totalCapital)
                    : "-"
                }
              />
              <SummaryDatum
                label="Total interés"
                value={
                  resultado.resumen
                    ? formatCurrencyCOP(resultado.resumen.totalInteres)
                    : "-"
                }
              />
              <SummaryDatum
                label="Total a pagar"
                value={
                  resultado.resumen
                    ? formatCurrencyCOP(resultado.resumen.totalPagar)
                    : "-"
                }
                strong
              />
              <SummaryDatum
                label="Cuotas"
                value={
                  resultado.resumen ? String(resultado.resumen.numeroCuotas) : "-"
                }
              />
            </div>
          </ReviewCard>
        </div>

        <label className={`mt-5 block ${surfaceRecipes.cardSubtle}`}>
          <span className="flex items-center gap-2 text-sm font-[var(--font-weight-label)] text-[var(--color-text-primary)]">
            <StickyNote className="h-4 w-4 text-[var(--color-selection-strong)]" />
            Nota opcional
          </span>
          <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
            Información útil para el seguimiento del crédito. Podrás editarla después.
          </span>
          <textarea
            value={nota}
            maxLength={1000}
            rows={3}
            onChange={(event) => onNotaChange(event.target.value)}
            placeholder="Ej.: Paga quincenal $150.000. Inicia pagos el 15/02/2026."
            className={`mt-3 ${formRecipes.textarea}`}
          />
          <span className="mt-1 block text-right text-xs text-[var(--color-text-muted)]">
            {nota.length}/1000
          </span>
        </label>

        {error ? (
          <div className={`mt-5 ${surfaceRecipes.alertDanger}`}>
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface ReviewCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  wideOnMedium?: boolean;
}

function ReviewCard({ icon: Icon, title, children, wideOnMedium }: ReviewCardProps) {
  return (
    <div
      className={[
        surfaceRecipes.cardSubtle,
        "text-sm leading-6 text-[var(--color-text-primary)]",
        wideOnMedium ? "lg:col-span-2 2xl:col-span-1" : "",
      ].join(" ")}
    >
      <p className="mb-3 flex items-center gap-2 font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
        <Icon className="h-4 w-4 text-[var(--color-selection-strong)]" />
        {title}
      </p>
      {children}
    </div>
  );
}

interface ReviewLineProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  strong?: boolean;
}

function ReviewLine({ icon: Icon, label, value, strong }: ReviewLineProps) {
  return (
    <p
      className={[
        "grid grid-cols-[1rem_minmax(7.5rem,auto)_minmax(0,1fr)] items-start gap-2",
        strong ? "font-[var(--font-weight-data-emphasis)] text-[var(--color-selection-strong)]" : "",
      ].join(" ")}
    >
      <Icon className="mt-1 h-3.5 w-3.5 text-[var(--color-selection-strong)]" />
      <span className="text-[var(--color-text-secondary)]">{label}:</span>
      <span className="min-w-0 break-words font-[var(--font-weight-data)] text-[var(--color-text-primary)]">{value}</span>
    </p>
  );
}

function SummaryDatum({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] px-3 py-2">
      <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p
        className={[
          "mt-1 break-words text-right font-[var(--font-weight-heading)]",
          strong ? "text-[var(--color-selection-strong)]" : "text-[var(--color-text-primary)]",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
