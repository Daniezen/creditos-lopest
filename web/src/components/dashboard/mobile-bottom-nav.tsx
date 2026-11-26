"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LogOut, MoreHorizontal } from "lucide-react";
import { signOut } from "next-auth/react";

import { dashboardNavigation } from "@/config/navigation";
import { navigationRecipes } from "@/design-system/recipes/navigation";

/**
 * Mobile navigation keeps primary destinations visible and moves secondary
 * actions into a restrained bottom sheet. Lopest's color remains recognizable,
 * but selection no longer depends on a saturated gradient or heavy shadow.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = dashboardNavigation.slice(0, 4);
  const reportsItem = dashboardNavigation.find((item) => item.href === "/reportes");
  const moreActive = Boolean(
    reportsItem &&
      (pathname === reportsItem.href || pathname.startsWith(`${reportsItem.href}/`)),
  );

  useEffect(() => {
    if (!moreOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 border-0 bg-[var(--color-overlay-backdrop)]"
            aria-label="Cerrar menú adicional"
            onClick={() => setMoreOpen(false)}
          />

          <section
            className="absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 rounded-t-3xl border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 pb-3 pt-3 shadow-[var(--ds-shadow-overlay)]"
            role="dialog"
            aria-modal="true"
            aria-label="Más opciones"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border-default)]" />

            {reportsItem ? (
              <Link
                href={reportsItem.href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-3 border-b border-[var(--color-border-subtle)] px-2 py-3 text-sm font-[var(--font-weight-action)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)]"
              >
                <BarChart3 className="h-5 w-5 text-[var(--color-selection-strong)]" />
                <span>Reportes</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex min-h-12 w-full items-center gap-3 px-2 py-3 text-sm font-[var(--font-weight-action)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)]"
            >
              <LogOut className="h-5 w-5 text-[var(--color-selection-strong)]" />
              <span>Cerrar sesión</span>
            </button>
          </section>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className={[
                  navigationRecipes.mobileItem,
                  isActive
                    ? navigationRecipes.mobileItemActive
                    : navigationRecipes.mobileItemIdle,
                ].join(" ")}
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" />
                <span className="line-clamp-1">{getShortLabel(item.label)}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={[
              navigationRecipes.mobileItem,
              moreOpen || moreActive
                ? navigationRecipes.mobileItemActive
                : navigationRecipes.mobileItemIdle,
            ].join(" ")}
          >
            <MoreHorizontal className="h-[1.125rem] w-[1.125rem]" />
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function getShortLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("simulador")) return "Simular";
  if (normalized.includes("transferencias")) return "Transferir";
  if (normalized.includes("crédito")) return "Créditos";
  return label;
}
