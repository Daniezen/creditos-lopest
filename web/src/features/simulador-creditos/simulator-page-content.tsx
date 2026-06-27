"use client";

import { RotateCcw } from "lucide-react";

import { EmptySimulationState } from "./components/empty-simulation-state";
import { SimulatorForm } from "./components/simulator-form";
import { SimulatorSchedule } from "./components/simulator-schedule";
import { SimulatorSummary } from "./components/simulator-summary";
import { useCreditSimulation } from "./hooks/use-credit-simulation";

/**
 * Simulador libre de créditos.
 *
 * Vista limpia:
 * - título;
 * - condiciones;
 * - resumen;
 * - cronograma.
 *
 * No crea créditos.
 * No exige cliente.
 * No persiste datos.
 */
export function SimulatorPageContent() {
  const { form, resultado, updateField, resetForm } = useCreditSimulation();

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">
          Simular crédito
        </h2>

        <button
          type="button"
          onClick={resetForm}
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar simulación
        </button>
      </header>

      <section className="space-y-6">
        <SimulatorForm form={form} onChange={updateField} variant="grid" />

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
    </main>
  );
}