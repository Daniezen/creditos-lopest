import {
  Check,
  ClipboardCheck,
  CreditCard,
  Lock,
  UserRound,
  WalletCards,
} from "lucide-react";

import { surfaceRecipes } from "@/design-system/recipes/surfaces";

interface CreateCreditStepperProps {
  currentStep: number;
  canGoToStep: (step: number) => boolean;
  onStepClick: (step: number) => void;
}

const steps = [
  {
    number: 1,
    label: "Cliente",
    description: "Seleccionar cliente",
    icon: UserRound,
  },
  {
    number: 2,
    label: "Crédito",
    description: "Condiciones y cronograma",
    icon: WalletCards,
  },
  {
    number: 3,
    label: "Confirmación",
    description: "Revisión final",
    icon: ClipboardCheck,
  },
];

/**
 * Stepper clickeable del flujo de creación de crédito.
 *
 * Reglas:
 * - Paso 1 siempre disponible.
 * - Paso 2 requiere cliente seleccionado.
 * - Paso 3 requiere cliente + simulación válida.
 */
export function CreateCreditStepper({
  currentStep,
  canGoToStep,
  onStepClick,
}: CreateCreditStepperProps) {
  return (
    <nav className={surfaceRecipes.card}>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isAvailable = canGoToStep(step.number);

          return (
            <li key={step.number}>
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => onStepClick(step.number)}
                className={[
                  "w-full rounded-2xl border p-4 text-left transition",
                  isActive
                    ? "border-[var(--color-border-default)] bg-[var(--color-selection)] shadow-[var(--ds-shadow-surface)] ring-2 ring-[var(--color-focus-soft)]"
                    : isCompleted
                      ? "border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-selection)]/40"
                      : "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]",
                  isAvailable
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-50",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-[var(--font-weight-data-emphasis)]",
                      isActive || isCompleted
                        ? "bg-[var(--color-action-primary)] text-[var(--color-text-on-accent)]"
                        : "bg-[var(--color-border-default)] text-[var(--color-text-secondary)]",
                    ].join(" ")}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isAvailable ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <p
                        className={[
                          "text-sm font-[var(--font-weight-heading)]",
                          isActive
                            ? "text-[var(--color-selection-strong)]"
                            : "text-[var(--color-text-primary)]",
                        ].join(" ")}
                      >
                        {step.label}
                      </p>

                      {step.number === 2 ? (
                        <CreditCard className="h-3.5 w-3.5 text-[var(--color-action-primary)]" />
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs leading-5 font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
                      {step.description}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}