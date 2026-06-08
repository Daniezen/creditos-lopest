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
  },
  {
    number: 2,
    label: "Crédito",
    description: "Condiciones y cronograma",
  },
  {
    number: 3,
    label: "Confirmación",
    description: "Revisión final",
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
    <nav className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
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
                    ? "border-violet-300 bg-violet-50 shadow-sm ring-2 ring-violet-500/10"
                    : isCompleted
                      ? "border-violet-100 bg-white hover:border-violet-200 hover:bg-violet-50/50"
                      : "border-slate-200 bg-slate-50",
                  isAvailable
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-50",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      isActive || isCompleted
                        ? "bg-violet-600 text-white"
                        : "bg-slate-200 text-slate-600",
                    ].join(" ")}
                  >
                    {isCompleted ? "✓" : step.number}
                  </span>

                  <div>
                    <p
                      className={[
                        "text-sm font-semibold",
                        isActive ? "text-violet-950" : "text-slate-800",
                      ].join(" ")}
                    >
                      {step.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
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