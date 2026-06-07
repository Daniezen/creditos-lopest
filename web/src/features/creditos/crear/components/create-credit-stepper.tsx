interface CreateCreditStepperProps {
  currentStep: number;
}

const steps = [
  {
    number: 1,
    label: "Cliente",
    description: "Seleccionar o preparar cliente",
  },
  {
    number: 2,
    label: "Condiciones",
    description: "Datos financieros del crédito",
  },
  {
    number: 3,
    label: "Vista previa",
    description: "Resumen y cronograma",
  },
  {
    number: 4,
    label: "Confirmación",
    description: "Revisión final antes de guardar",
  },
];

export function CreateCreditStepper({ currentStep }: CreateCreditStepperProps) {
  return (
    <nav className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map((step) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;

          return (
            <li
              key={step.number}
              className={[
                "rounded-2xl border p-4",
                isActive
                  ? "border-violet-300 bg-violet-50"
                  : isCompleted
                    ? "border-violet-100 bg-white"
                    : "border-slate-200 bg-slate-50",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    isActive || isCompleted
                      ? "bg-violet-600 text-white"
                      : "bg-slate-200 text-slate-600",
                  ].join(" ")}
                >
                  {step.number}
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
            </li>
          );
        })}
      </ol>
    </nav>
  );
}