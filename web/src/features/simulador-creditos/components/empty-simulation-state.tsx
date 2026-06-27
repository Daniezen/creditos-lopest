import { Calculator } from "lucide-react";

/**
 * Estado vacío del simulador.
 *
 * Debe orientar al usuario sin sonar a mensaje técnico ni a texto generado.
 */
export function EmptySimulationState() {
  return (
    <section className="rounded-[2rem] border border-dashed border-violet-200 bg-white/90 p-8 text-center shadow-sm shadow-violet-100/40">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-100 text-violet-700">
        <Calculator className="h-7 w-7" />
      </div>

      <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-950">
        Simulación pendiente
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Ingresa las condiciones del crédito para visualizar el resumen y el cronograma proyectado.
      </p>
    </section>
  );
}
