"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

import { crearCreditoDesdeWizard } from "../actions";

interface ConfirmationStepProps {
  cliente: ClienteSelectorOption | null;
  form: SimulatorFormState;
  resultado: SimulationResult;
  idempotencyKey: string;
}

/**
 * Paso final de creación.
 *
 * El botón guarda el crédito mediante server action transaccional.
 * El servidor recalcula el cronograma; no confía en el resultado del navegador.
 */
export function ConfirmationStep({
  cliente,
  form,
  resultado,
  idempotencyKey,
}: ConfirmationStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const monto = parseNumericInput(form.monto);
  const tasaMensual = parseTasaMensualInput(form.tasaMensual);
  const fechaPrestamo = form.fechaPrestamo
    ? parseDateInputValue(form.fechaPrestamo)
    : null;

  const canSave = cliente !== null && resultado.estado === "success";

  function handleGuardarCredito() {
    if (!cliente) {
      setError("Selecciona un cliente antes de guardar.");
      return;
    }

    if (resultado.estado !== "success") {
      setError("Completa las condiciones del crédito antes de guardar.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await crearCreditoDesdeWizard({
        clienteId: cliente.id,
        form,
        idempotencyKey,
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      router.push(`/creditos/${response.creditoId}`);
    });
  }

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

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleGuardarCredito}
          disabled={!canSave || isPending}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <ClipboardCheck className="h-4 w-4" />
          {isPending ? "Guardando..." : "Guardar crédito"}
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
