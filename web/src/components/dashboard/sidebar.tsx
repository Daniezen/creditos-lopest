"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";

/**
 * Sidebar principal del dashboard.
 *
 * Solo contiene navegación de producto.
 * No debe mostrar roadmap interno, notas técnicas ni mensajes de construcción.
 */
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 shadow-sm lg:block">
      <div className="mb-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
          <Landmark className="h-6 w-6" />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-violet-700">
          Créditos Lopest
        </p>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Plataforma
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Gestión, simulación y seguimiento de créditos.
        </p>
      </div>

      <nav className="space-y-2">
        {dashboardNavigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-2xl px-4 py-3 text-sm transition",
                isActive
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-500/20"
                  : "text-slate-600 hover:bg-violet-50 hover:text-violet-900",
              ].join(" ")}
            >
              <div className="flex gap-3">
                <div
                  className={[
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-violet-50 text-violet-700",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div>
                  <p className="font-semibold">{item.label}</p>

                  {item.description ? (
                    <p
                      className={[
                        "mt-1 text-xs leading-5",
                        isActive ? "text-violet-100" : "text-slate-400",
                      ].join(" ")}
                    >
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}