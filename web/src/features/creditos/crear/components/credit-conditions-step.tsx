"use client";

import { EmptySimulationState } from "@/features/simulador-creditos/components/empty-simulation-state";
import { SimulatorForm } from "@/features/simulador-creditos/components/simulator-form";
import { SimulatorSchedule } from "@/features/simulador-creditos/components/simulator-schedule";
import { SimulatorSummary } from "@/features/simulador-creditos/components/simulator-summary";

import type {
  SimulationResult,
  SimulatorFormState,
} from "@/features/simulador-creditos/types";

/**
 * Paso 2 del wizard.
 *
 * Une condiciones financieras + vista previa.
 * Esta decisión replica lo útil de la hoja original: el usuario ingresa
 * condiciones y ve inmediatamente el impacto en el cronograma.
 */
interface CreditConditionsStepProps {
  form: SimulatorFormState;
  resultado: SimulationResult;
  onChange: <K extends keyof SimulatorFormState>(
    field: K,
    value: SimulatorFormState[K],
  ) => void;
}

export function CreditConditionsStep({
  form,
  resultado,
  onChange,
}: CreditConditionsStepProps) {
  return (
    <section className="space-y-6">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <SimulatorForm form={form} onChange={onChange} />

        <section className="min-w-0 space-y-6">
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
        </section>
      </div>

      {resultado.cronograma.length > 0 ? (
        <SimulatorSchedule cronograma={resultado.cronograma} />
      ) : null}
    </section>
  );
}