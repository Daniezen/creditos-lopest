export function EmptySimulationState() {
  return (
    <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
        ₡
      </div>

      <h3 className="mt-4 text-lg font-semibold text-slate-950">
        Simulación pendiente
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Ingresa las condiciones del crédito para visualizar el resumen y el
        cronograma proyectado.
      </p>
    </section>
  );
}