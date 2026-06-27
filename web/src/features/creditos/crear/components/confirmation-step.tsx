"use client";

import {
  CalendarDays,
  ClipboardCheck,
  Coins,
  CreditCard,
  Hash,
  Percent,
  UserRound,
} from "lucide-react";

import type { ClienteSelectorOption } from "@/features/clientes/types";
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
}

/**
 * Paso 3 del wizard.
 *
 * Revisión final antes de guardar.
 */
export function ConfirmationStep({
  cliente,
  form,
  resultado,
}: ConfirmationStepProps) {
  const monto = parseNumericInput(form.monto);
  const tasaMensual = parseTasaMensualInput(form.tasaMensual);
  const fechaPrestamo = form.fechaPrestamo
    ? parseDateInputValue(form.fechaPrestamo)
    : null;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              Confirmación del crédito
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Revisa cliente, condiciones y totales antes de guardar.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <ReviewCard icon={UserRound} title="Cliente">
            <p>{cliente ? cliente.nombre : "Sin cliente"}</p>
            <p className="mt-1 text-slate-500">
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

          <ReviewCard icon={ClipboardCheck} title="Totales">
            <ReviewLine
              icon={Coins}
              label="Total capital"
              value={
                resultado.resumen
                  ? formatCurrencyCOP(resultado.resumen.totalCapital)
                  : "-"
              }
            />
            <ReviewLine
              icon={Percent}
              label="Total interés"
              value={
                resultado.resumen
                  ? formatCurrencyCOP(resultado.resumen.totalInteres)
                  : "-"
              }
            />
            <ReviewLine
              icon={CreditCard}
              label="Total a pagar"
              value={
                resultado.resumen
                  ? formatCurrencyCOP(resultado.resumen.totalPagar)
                  : "-"
              }
              strong
            />
            <ReviewLine
              icon={Hash}
              label="Cuotas"
              value={
                resultado.resumen ? String(resultado.resumen.numeroCuotas) : "-"
              }
            />
          </ReviewCard>
        </div>

        <button
          type="button"
          disabled
          className="mt-6 inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
        >
          <ClipboardCheck className="h-4 w-4" />
          Guardar crédito próximamente
        </button>
      </div>
    </section>
  );
}

interface ReviewCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

function ReviewCard({ icon: Icon, title, children }: ReviewCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <p className="mb-3 flex items-center gap-2 font-semibold text-slate-950">
        <Icon className="h-4 w-4 text-violet-600" />
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
        "flex items-center gap-2",
        strong ? "font-semibold text-violet-900" : "",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 text-violet-500" />
      <span className="text-slate-500">{label}:</span>
      <span>{value}</span>
    </p>
  );
}