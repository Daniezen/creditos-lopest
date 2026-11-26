import { Calculator } from "lucide-react";

/**
 * Estado vacío del simulador.
 *
 * Debe orientar al usuario sin sonar a mensaje técnico ni a texto generado.
 */
export function EmptySimulationState() {
  return (
    <section className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/80 p-8 text-center shadow-[var(--ds-shadow-surface)]">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-selection)] text-[var(--color-selection-strong)]">
        <Calculator className="h-5 w-5" />
      </div>

      <h3 className="mt-3 text-base font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
        Simulación pendiente
      </h3>

      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
        Ingresa las condiciones del crédito para visualizar el resumen y el cronograma proyectado.
      </p>
    </section>
  );
}
