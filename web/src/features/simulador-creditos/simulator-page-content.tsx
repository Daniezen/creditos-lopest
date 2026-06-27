"use client";

import { Calculator, RotateCcw } from "lucide-react";

import { EmptySimulationState } from "./components/empty-simulation-state";
import { SimulatorForm } from "./components/simulator-form";
import { SimulatorSchedule } from "./components/simulator-schedule";
import { SimulatorSummary } from "./components/simulator-summary";
import { useCreditSimulation } from "./hooks/use-credit-simulation";

/**
 * Simulador libre de créditos.
 *
 * No crea créditos.
 * No exige cliente.
 * No persiste datos.
 */
export function SimulatorPageContent() {
  const { form, resultado, updateField, resetForm } = useCreditSimulation();

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 overflow-hidden rounded-[2rem] border border-violet-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_38%,#fff7ed_100%)] shadow-[0_18px_45px_rgba(109,40,217,0.10)]">
        <div className="flex flex-col justify-between gap-5 px-6 py-6 sm:px-7 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/80 text-violet-700 shadow-sm shadow-violet-100 ring-1 ring-violet-100">
              <Calculator className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
                Simulador de crédito
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                Simular crédito
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white/85 px-5 py-3 text-sm font-bold text-violet-700 shadow-sm shadow-violet-100/50 transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar simulación
          </button>
        </div>
      </header>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 xl:sticky xl:top-6 xl:h-fit">
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
            <SimulatorSchedule cronograma={resultado.cronograma} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
