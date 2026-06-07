import Link from "next/link";

interface ModulePlaceholderAction {
  label: string;
  href: string;
}

interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  currentScope: string[];
  nextSteps: string[];
  primaryAction?: ModulePlaceholderAction;
  secondaryAction?: ModulePlaceholderAction;
}

/**
 * Placeholder profesional para módulos del dashboard.
 *
 * No es una pantalla vacía. Documenta:
 * - propósito del módulo;
 * - alcance inicial;
 * - próximos pasos técnicos;
 * - acción principal si aplica.
 */
export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  currentScope,
  nextSteps,
  primaryAction,
  secondaryAction,
}: ModulePlaceholderProps) {
  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-violet-700">{eyebrow}</p>

        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">
            Alcance inicial
          </h3>

          <ul className="mt-4 space-y-3">
            {currentScope.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                {primaryAction.label}
              </Link>
            ) : null}

            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="rounded-3xl border border-violet-200 bg-violet-50 p-6">
          <h3 className="text-lg font-semibold text-violet-950">
            Próximos pasos
          </h3>

          <ol className="mt-4 space-y-3">
            {nextSteps.map((item, index) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-violet-900">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-violet-700 ring-1 ring-violet-200">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  );
}