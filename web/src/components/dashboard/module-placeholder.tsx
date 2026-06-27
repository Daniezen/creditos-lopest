import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ModulePlaceholderAction {
  label: string;
  href: string;
}

interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  primaryAction?: ModulePlaceholderAction;
  secondaryAction?: ModulePlaceholderAction;
}

/**
 * Estado vacío profesional para módulos todavía sin datos operativos.
 *
 * No muestra roadmap técnico ni notas internas.
 */
export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  icon: Icon,
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

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-violet-700">
            <Icon className="h-8 w-8" />
          </div>

          <h3 className="mt-5 text-xl font-bold tracking-tight text-slate-950">
            {title}
          </h3>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {description}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
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
      </section>
    </main>
  );
}