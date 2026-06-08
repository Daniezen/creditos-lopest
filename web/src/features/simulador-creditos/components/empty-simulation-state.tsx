import { Calculator, Sparkles } from "lucide-react";

export function EmptySimulationState() {
  return (
    <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
        <Calculator className="h-6 w-6" />
      </div>

      <h3 className="mt-4 inline-flex items-center justify-center gap-2 text-lg font-semibold text-slate-950">
        Simulación pendiente
        <Sparkles className="h-4 w-4 text-violet-500" />
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Ingresa las condiciones del crédito para visualizar el resumen y el
        cronograma proyectado.
      </p>
    </section>
  );
}