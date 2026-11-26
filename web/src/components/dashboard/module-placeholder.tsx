import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";

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
      <header className="mb-8 border-b border-[var(--color-border-subtle)] pb-6">
        <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-selection-strong)]">
          {eyebrow}
        </p>

        <h2 className="mt-2 text-2xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h2>

        <p className="mt-2 max-w-3xl text-sm font-[var(--font-weight-body)] leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>
      </header>

      <section className={`${surfaceRecipes.section} p-8`}>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-selection)] text-[var(--color-selection-strong)]">
            <Icon className="h-7 w-7" />
          </div>

          <h3 className="mt-5 text-xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h3>

          <p className="mt-3 text-sm font-[var(--font-weight-body)] leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                className={actionRecipes.primaryLarge}
              >
                {primaryAction.label}
              </Link>
            ) : null}

            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className={actionRecipes.secondaryLarge}
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