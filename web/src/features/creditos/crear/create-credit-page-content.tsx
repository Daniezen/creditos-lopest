"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { SimulatorForm } from "@/features/simulador-creditos/components/simulator-form";
import { SimulatorSchedule } from "@/features/simulador-creditos/components/simulator-schedule";
import { SimulatorSummary } from "@/features/simulador-creditos/components/simulator-summary";
import { useCreditSimulation } from "@/features/simulador-creditos/hooks/use-credit-simulation";

import type { ClienteSelectorOption } from "@/features/clientes/types";

import { ClientStep } from "./components/client-step";
import { CreateCreditStepper } from "./components/create-credit-stepper";

interface CreateCreditPageContentProps {
  initialClientes: ClienteSelectorOption[];
}

/**
 * Flujo formal de creación de crédito.
 *
 * /simulador:
 * - simula libremente;
 * - no exige cliente;
 * - no guarda.
 *
 * /creditos/nuevo:
 * - exige cliente;
 * - usa condiciones financieras;
 * - muestra vista previa;
 * - más adelante guardará en transacción Prisma.
 */
export function CreateCreditPageContent({
  initialClientes,
}: CreateCreditPageContentProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [clientes, setClientes] =
    useState<ClienteSelectorOption[]>(initialClientes);
  const [selectedCliente, setSelectedCliente] =
    useState<ClienteSelectorOption | null>(null);

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
    setSelectedCliente(null);
    setCurrentStep(1);
  }

  function handleClienteCreado(cliente: ClienteSelectorOption) {
    setClientes((current) => {
      const exists = current.some((item) => item.id === cliente.id);

      if (exists) {
        return current;
      }

      return [cliente, ...current];
    });
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
            Flujo controlado para crear un crédito real. Esta versión ya permite
            seleccionar o crear cliente y reutiliza el simulador financiero para
            vista previa.
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
          <ClientStep
            clientes={clientes}
            selectedCliente={selectedCliente}
            onSelectCliente={setSelectedCliente}
            onClienteCreado={handleClienteCreado}
          />
        ) : null}

        {currentStep === 2 ? (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <SimulatorForm form={form} onChange={updateField} />

            <section className="min-w-0 space-y-6">
              <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                <p className="text-sm font-semibold text-violet-950">
                  Cliente seleccionado
                </p>
                <p className="mt-1 text-sm text-violet-800">
                  {selectedCliente
                    ? `${selectedCliente.nombre} — C.C. ${selectedCliente.cedula}`
                    : "Ningún cliente seleccionado"}
                </p>
              </div>

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

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Cliente</p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedCliente
                    ? `${selectedCliente.nombre} — C.C. ${selectedCliente.cedula}`
                    : "Sin cliente"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Cronograma
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {resultado.cronograma.length} cuota(s) generadas
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
              El guardado seguirá deshabilitado hasta implementar server action,
              transacción Prisma y generación segura del código LP.
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
              (currentStep === 1 && !selectedCliente) ||
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
