"use client";

import { EmptySimulationState } from "@/features/simulador-creditos/components/empty-simulation-state";
import { SimulatorForm } from "@/features/simulador-creditos/components/simulator-form";
import { SimulatorSchedule } from "@/features/simulador-creditos/components/simulator-schedule";

import type {
  SimulationResult,
  SimulatorFormState,
} from "@/features/simulador-creditos/types";

import { CreditSummaryCompact } from "./credit-summary-compact";

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
 * Desktop:
 * - condiciones a la izquierda;
 * - resumen compacto y cronograma completo a la derecha.
 *
 * Pantallas medianas/móviles:
 * - contenido apilado para evitar cortes horizontales.
 */
export function CreditConditionsStep({
  form,
  resultado,
  onChange,
}: CreditConditionsStepProps) {
  return (
    <section className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="min-w-0 xl:sticky xl:top-6 xl:h-fit">
        <SimulatorForm form={form} onChange={onChange} variant="panel" />
      </div>

      <div className="min-w-0 space-y-6">
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
          <CreditSummaryCompact resumen={resultado.resumen} />
        ) : null}

        {resultado.cronograma.length > 0 ? (
          <SimulatorSchedule cronograma={resultado.cronograma} showEstado={false} />
        ) : null}
      </div>
    </section>
  );
}
