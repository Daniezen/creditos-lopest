"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

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

function createIdempotencyKey() {
  return `credito-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function CreateCreditPageContent({
  initialClientes,
}: CreateCreditPageContentProps) {
  const [currentStep, setCurrentStep] = useState<CreateCreditStep>(1);
  const [clientes, setClientes] =
    useState<ClienteSelectorOption[]>(initialClientes);
  const [selectedCliente, setSelectedCliente] =
    useState<ClienteSelectorOption | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);

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
    setIdempotencyKey(createIdempotencyKey());
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
        <section className="mb-5 flex flex-col justify-between gap-3 rounded-[2rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
              Flujo de creación
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Paso {currentStep} de 3
              {selectedCliente ? ` · ${selectedCliente.nombre}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/creditos"
              className="rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
            >
              Volver a créditos
            </Link>

            <button
              type="button"
              onClick={resetWizard}
              className="inline-flex items-center gap-2 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>
          </div>
        </section>

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
              idempotencyKey={idempotencyKey}
            />
          ) : null}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6 lg:left-[92px] lg:px-10">
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
              {currentStep === 3 ? "Guardar arriba" : "Continuar"}
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
