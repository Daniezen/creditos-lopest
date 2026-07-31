"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LogOut, MoreHorizontal } from "lucide-react";
import { signOut } from "next-auth/react";

import { dashboardNavigation } from "@/config/navigation";

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
            className="absolute inset-0 border-0 bg-slate-950/45"
            aria-label="Cerrar menú adicional"
            onClick={() => setMoreOpen(false)}
          />

          <section
            className="absolute inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 rounded-t-3xl border-t border-slate-200 bg-white px-4 pb-3 pt-3 shadow-[0_-14px_36px_rgb(15_23_42/0.12)]"
            role="dialog"
            aria-modal="true"
            aria-label="Más opciones"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />

            {reportsItem ? (
              <Link
                href={reportsItem.href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-3 border-b border-slate-100 px-2 py-3 text-sm font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-900"
              >
                <BarChart3 className="h-5 w-5 text-violet-700" />
                <span>Reportes</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="flex min-h-12 w-full items-center gap-3 px-2 py-3 text-sm font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-900"
            >
              <LogOut className="h-5 w-5 text-violet-700" />
              <span>Cerrar sesión</span>
            </button>
          </section>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden">
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
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition",
                  isActive
                    ? "bg-violet-100/80 text-violet-950"
                    : "text-slate-500 hover:bg-violet-50 hover:text-violet-800",
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
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition",
              moreOpen || moreActive
                ? "bg-violet-100/80 text-violet-950"
                : "text-slate-500 hover:bg-violet-50 hover:text-violet-800",
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
