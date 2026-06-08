"use client";

import { EmptySimulationState } from "@/features/simulador-creditos/components/empty-simulation-state";
import { SimulatorForm } from "@/features/simulador-creditos/components/simulator-form";
import { SimulatorSchedule } from "@/features/simulador-creditos/components/simulator-schedule";
import { SimulatorSummary } from "@/features/simulador-creditos/components/simulator-summary";

import type {
  SimulationResult,
  SimulatorFormState,
} from "@/features/simulador-creditos/types";

interface CreditConditionsStepProps {
  form: SimulatorFormState;
  resultado: SimulationResult;
  onChange: <K extends keyof SimulatorFormState>(
    field: K,
    value: SimulatorFormState[K],
  ) => void;
}

/**
 * Paso Crédito.
 *
 * Layout corregido:
 * - Condiciones a ancho completo.
 * - Resumen debajo.
 * - Cronograma debajo a ancho completo.
 *
 * Esto elimina el riel estrecho de formulario y el espacio muerto visible
 * en pantallas pequeñas/medianas.
 */
export function CreditConditionsStep({
  form,
  resultado,
  onChange,
}: CreditConditionsStepProps) {
  return (
    <section className="space-y-6">
      <SimulatorForm form={form} onChange={onChange} variant="grid" />

      {resultado.estado === "empty" ? <EmptySimulationState /> : null}

      {resultado.estado === "error" && resultado.error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900">
          <h3 className="font-semibold">No se pudo simular</h3>

          <p className="mt-2 text-sm leading-6 text-red-700">
            {resultado.error}
          </p>
        </div>
      ) : null}

      {resultado.resumen ? (
        <SimulatorSummary resumen={resultado.resumen} />
      ) : null}

      {resultado.cronograma.length > 0 ? (
        <SimulatorSchedule cronograma={resultado.cronograma} />
      ) : null}
    </section>
  );
}