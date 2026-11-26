"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import type { ClienteSelectorOption } from "@/features/clientes/types";
import { useCreditSimulation } from "@/features/simulador-creditos/hooks/use-credit-simulation";

import { ClientStep } from "./components/client-step";
import { ConfirmationStep } from "./components/confirmation-step";
import { CreateCreditStepper } from "./components/create-credit-stepper";
import { CreditConditionsStep } from "./components/credit-conditions-step";
import { crearCreditoDesdeWizard } from "./actions";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
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

  const canSaveCredit = selectedCliente !== null && hasValidSimulation;

  function handleGuardarCredito() {
    if (!selectedCliente) {
      setSaveError("Selecciona un cliente antes de guardar.");
      return;
    }

    if (resultado.estado !== "success") {
      setSaveError("Completa las condiciones del crédito antes de guardar.");
      return;
    }

    setSaveError(null);

    startTransition(async () => {
      let response = await crearCreditoDesdeWizard({
        clienteId: selectedCliente.id,
        form,
        nota,
        idempotencyKey,
      });

      if (!response.ok && response.possibleDuplicates?.length) {
        const detalles = response.possibleDuplicates
          .map(
            (item) =>
              `${item.codigo} · $${item.monto.toLocaleString("es-CO")} · ${item.fechaPrestamo.slice(0, 10)} · ${item.ownerNombre ?? item.ownerEmail ?? "Sin propietario"}`,
          )
          .join("\n");
        const continuar = window.confirm(
          `Este cliente ya tiene créditos similares en la cartera actual o en la otra cartera:\n\n${detalles}\n\n¿Confirmas que el nuevo crédito es diferente?`,
        );

        if (!continuar) {
          return;
        }

        const motivoDuplicado = window.prompt(
          "Explica por qué se trata de un crédito diferente:",
        )?.trim();

        if (!motivoDuplicado) {
          return;
        }

        response = await crearCreditoDesdeWizard({
          clienteId: selectedCliente.id,
          form,
          nota,
          idempotencyKey,
          confirmarPosibleDuplicado: true,
          motivoDuplicado,
        });
      }

      if (!response.ok) {
        setSaveError(response.error);
        return;
      }

      router.push(`/creditos/${response.creditoId}`);
      router.refresh();
    });
  }

  function canGoToStep(step: number): boolean {
    if (step === 1) return true;
    if (step === 2) return selectedCliente !== null;
    if (step === 3) return selectedCliente !== null && hasValidSimulation;
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
    setNota("");
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
        <section className={surfaceRecipes.pageHeaderBand}>
          <div>
            <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-selection-strong)]">
              Flujo de creación
            </p>
            <p className="mt-1 text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
              Paso {currentStep} de 3
              {selectedCliente ? ` · ${selectedCliente.nombre}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/creditos"
              className={actionRecipes.secondary}
            >
              Volver a créditos
            </Link>

            <button
              type="button"
              onClick={resetWizard}
              className={actionRecipes.secondary}
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
              nota={nota}
              onNotaChange={setNota}
              error={saveError}
            />
          ) : null}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/95 px-4 py-3 shadow-[var(--ds-shadow-overlay)] backdrop-blur sm:px-6 lg:left-[var(--ds-sidebar-width)] lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
            Paso {currentStep} de 3
            {selectedCliente ? (
              <span className="ml-2 hidden text-[var(--color-text-primary)] sm:inline">
                · {selectedCliente.nombre}
              </span>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={currentStep === 1}
              className={actionRecipes.secondary}
            >
              Atrás
            </button>

            {currentStep === 3 ? (
              <button
                type="button"
                onClick={handleGuardarCredito}
                disabled={!canSaveCredit || isPending}
                className={actionRecipes.primaryLarge}
              >
                {isPending ? "Guardando..." : "Guardar crédito"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoToStep(currentStep + 1)}
                className={actionRecipes.primaryLarge}
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
