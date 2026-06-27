"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";

/**
 * Navegación inferior responsive.
 *
 * Intención:
 * - cuando no hay espacio para sidebar, la navegación pasa abajo;
 * - replica el patrón estructural de Conecta/Impulsa sin copiar colores;
 * - evita que el contenido quede tapado agregando padding inferior desde layout.
 *
 * Restricción:
 * - este componente no decide permisos;
 * - solo navega.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const hasOverflow = dashboardNavigation.length > 4;
  const visibleItems = hasOverflow
    ? dashboardNavigation.slice(0, 4)
    : dashboardNavigation;
  const overflowItem = hasOverflow ? dashboardNavigation[4] : null;
  const gridClass = hasOverflow ? "grid-cols-5" : "grid-cols-4";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-100 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_40px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className={`grid ${gridClass} gap-2`}>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-black transition",
                isActive
                  ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100"
                  : "text-slate-500 hover:bg-violet-50 hover:text-violet-700",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <span className="line-clamp-1">{getShortLabel(item.label)}</span>
            </Link>
          );
        })}

        {overflowItem ? (
          <Link
            href={overflowItem.href}
            className={[
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-black transition",
              pathname === overflowItem.href ||
              pathname.startsWith(`${overflowItem.href}/`)
                ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100"
                : "text-slate-500 hover:bg-violet-50 hover:text-violet-700",
            ].join(" ")}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>Más</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function getShortLabel(label: string): string {
  if (label.toLowerCase().includes("simulador")) {
    return "Simular";
  }

  if (label.toLowerCase().includes("crédito")) {
    return "Créditos";
  }

  return label;
}
