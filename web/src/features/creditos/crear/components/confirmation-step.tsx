"use client";

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
 * El guardado sigue deshabilitado hasta implementar transacción Prisma.
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
        <h3 className="text-lg font-semibold text-slate-950">
          Confirmación del crédito
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Revisa cliente, condiciones y totales antes de guardar. El botón de
          guardado se habilitará cuando exista la acción transaccional en
          servidor.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <ReviewCard title="Cliente">
            <p>{cliente ? cliente.nombre : "Sin cliente"}</p>
            <p className="mt-1 text-slate-500">
              {cliente ? `C.C. ${cliente.cedula}` : "-"}
            </p>
          </ReviewCard>

          <ReviewCard title="Condiciones">
            <p>Monto: {formatCurrencyCOP(monto)}</p>
            <p>Tasa: {formatPercent(tasaMensual)}</p>
            <p>Plazo: {form.plazoMeses || "-"} meses</p>
            <p>Frecuencia: {form.frecuencia || "-"}</p>
            <p>Tipo: {form.tipoAmortizacion || "-"}</p>
            <p>
              Fecha préstamo:{" "}
              {fechaPrestamo ? formatDateCO(fechaPrestamo) : "-"}
            </p>
          </ReviewCard>

          <ReviewCard title="Totales">
            <p>
              Total capital:{" "}
              {resultado.resumen
                ? formatCurrencyCOP(resultado.resumen.totalCapital)
                : "-"}
            </p>
            <p>
              Total interés:{" "}
              {resultado.resumen
                ? formatCurrencyCOP(resultado.resumen.totalInteres)
                : "-"}
            </p>
            <p className="font-semibold text-violet-900">
              Total a pagar:{" "}
              {resultado.resumen
                ? formatCurrencyCOP(resultado.resumen.totalPagar)
                : "-"}
            </p>
            <p>
              Cuotas:{" "}
              {resultado.resumen ? resultado.resumen.numeroCuotas : "-"}
            </p>
          </ReviewCard>
        </div>

        <button
          type="button"
          disabled
          className="mt-6 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
        >
          Guardar crédito próximamente
        </button>
      </div>
    </section>
  );
}

interface ReviewCardProps {
  title: string;
  children: React.ReactNode;
}

function ReviewCard({ title, children }: ReviewCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
      <p className="mb-2 font-semibold text-slate-950">{title}</p>
      {children}
    </div>
  );
}