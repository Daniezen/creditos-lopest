"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { SimulatorForm } from "@/features/simulador-creditos/components/simulator-form";
import { SimulatorSchedule } from "@/features/simulador-creditos/components/simulator-schedule";
import { SimulatorSummary } from "@/features/simulador-creditos/components/simulator-summary";
import { useCreditSimulation } from "@/features/simulador-creditos/hooks/use-credit-simulation";

import { CreateCreditStepper } from "./components/create-credit-stepper";

/**
 * Flujo formal de creación de crédito.
 *
 * Este flujo NO es el simulador libre.
 *
 * Diferencia:
 * - /simulador permite simular sin cliente y sin guardar.
 * - /creditos/nuevo exige flujo formal: cliente, condiciones, vista previa,
 *   confirmación y, más adelante, guardado transaccional.
 *
 * En esta primera versión, el guardado sigue deshabilitado deliberadamente.
 */
export function CreateCreditPageContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const { form, resultado, updateField, resetForm } = useCreditSimulation();

  const canGoToPreview = resultado.estado === "success";

  const canConfirm = useMemo(() => {
    return resultado.estado === "success" && resultado.cronograma.length > 0;
  }, [resultado]);

  function goNext() {
    setCurrentStep((step) => Math.min(step + 1, 4));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  function resetWizard() {
    resetForm();
    setCurrentStep(1);
  }

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-violet-700">
            Creación formal
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Nuevo crédito
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Flujo controlado para crear un crédito real. Esta versión prepara la
            estructura del wizard y reutiliza el simulador financiero, pero aún
            no persiste datos en PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/creditos"
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            Volver a créditos
          </Link>

          <button
            type="button"
            onClick={resetWizard}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            Reiniciar flujo
          </button>
        </div>
      </header>

      <div className="space-y-6">
        <CreateCreditStepper currentStep={currentStep} />

        {currentStep === 1 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="max-w-3xl">
              <h3 className="text-lg font-semibold text-slate-950">
                Paso 1: Cliente
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Aquí irá la selección de cliente existente o la creación mínima
                de cliente. No se implementa todavía porque requiere diseño de
                búsqueda, validación de cédula y persistencia.
              </p>

              <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
                Decisión de arquitectura: el simulador libre no exige cliente,
                pero este flujo sí lo exigirá antes de guardar un crédito real.
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === 2 ? (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <SimulatorForm form={form} onChange={updateField} />

            <section className="min-w-0 space-y-6">
              {resultado.estado === "empty" ? (
                <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-8 text-center shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-950">
                    Condiciones pendientes
                  </h3>

                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Completa las condiciones financieras para habilitar la vista
                    previa del cronograma.
                  </p>
                </section>
              ) : null}

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
        ) : null}

        {currentStep === 3 ? (
          <section className="space-y-6">
            {resultado.resumen ? (
              <SimulatorSummary resumen={resultado.resumen} />
            ) : null}

            {resultado.cronograma.length > 0 ? (
              <SimulatorSchedule cronograma={resultado.cronograma} />
            ) : (
              <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-8 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">
                  No hay cronograma
                </h3>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Regresa al paso de condiciones financieras y completa los
                  datos para generar la vista previa.
                </p>
              </section>
            )}
          </section>
        ) : null}

        {currentStep === 4 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">
              Paso 4: Confirmación
            </h3>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              En esta fase se revisará cliente, condiciones financieras y
              cronograma antes de guardar. El botón de guardado seguirá
              deshabilitado hasta implementar server action, transacción Prisma
              y generación segura del código LP.
            </p>

            <button
              type="button"
              disabled
              className="mt-6 cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Guardar crédito próximamente
            </button>
          </section>
        ) : null}

        <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 1}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Atrás
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={
              currentStep === 4 ||
              (currentStep === 2 && !canGoToPreview) ||
              (currentStep === 3 && !canConfirm)
            }
            className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Continuar
          </button>
        </footer>
      </div>
    </main>
  );
}
