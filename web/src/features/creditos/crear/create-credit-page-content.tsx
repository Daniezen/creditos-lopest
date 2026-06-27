"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { ClienteSelectorOption } from "@/features/clientes/types";
import { useCreditSimulation } from "@/features/simulador-creditos/hooks/use-credit-simulation";

import { ClientStep } from "./components/client-step";
import { ConfirmationStep } from "./components/confirmation-step";
import { CreateCreditStepper } from "./components/create-credit-stepper";
import { CreditConditionsStep } from "./components/credit-conditions-step";

interface CreateCreditPageContentProps {
  initialClientes: ClienteSelectorOption[];
}

type CreateCreditStep = 1 | 2 | 3;

/**
 * Flujo formal de creación de crédito.
 *
 * Flujo:
 * 1. Cliente
 * 2. Crédito: condiciones + preview inmediato
 * 3. Confirmación
 *
 * No guarda todavía.
 */
export function CreateCreditPageContent({
  initialClientes,
}: CreateCreditPageContentProps) {
  const [currentStep, setCurrentStep] = useState<CreateCreditStep>(1);
  const [clientes, setClientes] =
    useState<ClienteSelectorOption[]>(initialClientes);
  const [selectedCliente, setSelectedCliente] =
    useState<ClienteSelectorOption | null>(null);

  const { form, resultado, updateField, resetForm } = useCreditSimulation();

  const hasValidSimulation = useMemo(() => {
    return resultado.estado === "success" && resultado.cronograma.length > 0;
  }, [resultado]);

  function canGoToStep(step: number) {
    if (step === 1) {
      return true;
    }

    if (step === 2) {
      return selectedCliente !== null;
    }

    if (step === 3) {
      return selectedCliente !== null && hasValidSimulation;
    }

    return false;
  }

  function goToStep(step: number) {
    if (!canGoToStep(step)) {
      return;
    }

    setCurrentStep(step as CreateCreditStep);
  }

  function goNext() {
    const nextStep = Math.min(currentStep + 1, 3);

    if (canGoToStep(nextStep)) {
      setCurrentStep(nextStep as CreateCreditStep);
    }
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 1) as CreateCreditStep);
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
    <main className="min-w-0 pb-28">
      <div className="px-4 py-6 sm:px-6 lg:px-10">
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold text-violet-700">
              Creación formal
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Nuevo crédito
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Selecciona el cliente, define las condiciones del crédito y revisa el cronograma antes de guardar.
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
          <CreateCreditStepper
            currentStep={currentStep}
            canGoToStep={canGoToStep}
            onStepClick={goToStep}
          />

          {currentStep === 1 ? (
            <ClientStep
              clientes={clientes}
              selectedCliente={selectedCliente}
              onSelectCliente={setSelectedCliente}
              onClienteCreado={handleClienteCreado}
            />
          ) : null}

          {currentStep === 2 ? (
            <CreditConditionsStep
              form={form}
              resultado={resultado}
              onChange={updateField}
            />
          ) : null}

          {currentStep === 3 ? (
            <ConfirmationStep
              cliente={selectedCliente}
              form={form}
              resultado={resultado}
            />
          ) : null}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 lg:left-72 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            Paso {currentStep} de 3
            {selectedCliente ? (
              <span className="ml-2 hidden text-slate-700 sm:inline">
                · {selectedCliente.nombre}
              </span>
            ) : null}
          </div>

          <div className="flex gap-3">
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
              disabled={currentStep === 3 || !canGoToStep(currentStep + 1)}
              className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Continuar
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}