"use client";

import { EmptySimulationState } from "./components/empty-simulation-state";
import { SimulatorForm } from "./components/simulator-form";
import { SimulatorSchedule } from "./components/simulator-schedule";
import { SimulatorSummary } from "./components/simulator-summary";
import { useCreditSimulation } from "./hooks/use-credit-simulation";

/**
 * Contenido principal de la página del simulador libre.
 *
 * Decisión de producto:
 * - Esta vista NO crea créditos.
 * - Esta vista NO selecciona clientes.
 * - Esta vista NO persiste datos.
 *
 * Flujo permitido aquí:
 *   Entrada financiera → Vista previa → Cronograma
 *
 * Flujo NO permitido aquí:
 *   Cliente → Confirmar → Guardar crédito
 *
 * Ese flujo vivirá en /creditos/nuevo y reutilizará el motor financiero y
 * componentes de resumen/cronograma, pero con persistencia transaccional.
 */
export function SimulatorPageContent() {
  const { form, resultado, updateField, resetForm } = useCreditSimulation();

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-violet-700">
            Simulador financiero
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Simular crédito
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Genera cronogramas proyectados sin cliente obligatorio y sin guardar
            datos. Esta herramienta sirve para validar condiciones financieras
            antes de iniciar un flujo formal de creación.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            Limpiar simulación
          </button>
        </div>
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <SimulatorForm form={form} onChange={updateField} />

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

          {resultado.cronograma.length > 0 ? (
            <SimulatorSchedule cronograma={resultado.cronograma} />
          ) : null}
        </section>
      </div>
    </main>
  );
}