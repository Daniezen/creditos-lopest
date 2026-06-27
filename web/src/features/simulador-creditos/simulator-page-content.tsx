"use client";

import { EmptySimulationState } from "./components/empty-simulation-state";
import { SimulatorForm } from "./components/simulator-form";
import { SimulatorSchedule } from "./components/simulator-schedule";
import { SimulatorSummary } from "./components/simulator-summary";
import { useCreditSimulation } from "./hooks/use-credit-simulation";

/**
 * Simulador libre de créditos.
 *
 * Decisión de diseño:
 * - La identidad visual de la vista vive en la topbar global.
 * - Esta vista se concentra en el trabajo real:
 *   condiciones, resumen y cuotas.
 * - Se elimina el bloque intermedio "Resultado / Simulación generada" porque
 *   crea fricción en móvil y empuja las métricas hacia abajo.
 *
 * Reglas funcionales:
 * - No crea créditos.
 * - No exige cliente.
 * - No persiste datos.
 *
 * Reinicio:
 * - El botón de reinicio se muestra dentro del bloque de cuotas, donde ya existe
 *   una simulación generada y el usuario puede decidir recalcular.
 */
export function SimulatorPageContent() {
  const { form, resultado, updateField, resetForm } = useCreditSimulation();

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 xl:sticky xl:top-[118px] xl:h-fit">
          <SimulatorForm form={form} onChange={updateField} variant="panel" />
        </div>

        <div className="min-w-0 space-y-6">
          {resultado.estado === "empty" ? <EmptySimulationState /> : null}

          {resultado.estado === "error" && resultado.error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900 shadow-sm">
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
            <SimulatorSchedule
              cronograma={resultado.cronograma}
              onReset={resetForm}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
