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
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              Confirmación del crédito
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Al guardar, se abrirá el detalle del crédito creado.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <ReviewCard icon={UserRound} title="Cliente">
            <p className="font-semibold text-slate-950">
              {cliente ? cliente.nombre : "Sin cliente"}
            </p>
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


        <label className="mt-5 block rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <StickyNote className="h-4 w-4 text-violet-600" />
            Nota opcional
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            Información útil para el seguimiento del crédito. Podrás editarla después.
          </span>
          <textarea
            value={nota}
            maxLength={1000}
            rows={3}
            onChange={(event) => onNotaChange(event.target.value)}
            placeholder="Ej.: Paga quincenal $150.000. Inicia pagos el 15/02/2026."
            className="mt-3 w-full resize-y rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
          />
          <span className="mt-1 block text-right text-[11px] text-slate-400">
            {nota.length}/1000
          </span>
        </label>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        "rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700",
        wideOnMedium ? "lg:col-span-2 2xl:col-span-1" : "",
      ].join(" ")}
    >
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
        "grid grid-cols-[1rem_minmax(7.5rem,auto)_minmax(0,1fr)] items-start gap-2",
        strong ? "font-semibold text-violet-900" : "",
      ].join(" ")}
    >
      <Icon className="mt-1 h-3.5 w-3.5 text-violet-500" />
      <span className="text-slate-500">{label}:</span>
      <span className="min-w-0 break-words text-slate-950">{value}</span>
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
    <div className="rounded-2xl border border-violet-100 bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={[
          "mt-1 break-words text-right font-black",
          strong ? "text-violet-800" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
