import {
  Check,
  ClipboardCheck,
  CreditCard,
  Lock,
  UserRound,
  WalletCards,
} from "lucide-react";

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
    <nav className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold",
                      isActive || isCompleted
                        ? "bg-violet-600 text-white"
                        : "bg-slate-200 text-slate-600",
                    ].join(" ")}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : isAvailable ? (
                      <Icon className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <p
                        className={[
                          "text-sm font-semibold",
                          isActive ? "text-violet-950" : "text-slate-800",
                        ].join(" ")}
                      >
                        {step.label}
                      </p>

                      {step.number === 2 ? (
                        <CreditCard className="h-3.5 w-3.5 text-violet-500" />
                      ) : null}
                    </div>

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