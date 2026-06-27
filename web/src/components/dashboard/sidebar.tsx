"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";

/**
 * Sidebar principal de Créditos Lopest.
 *
 * Decisión visual:
 * - navegación clara, no oscura;
 * - sin descripciones largas;
 * - ancho suficiente para respirar;
 * - acento lila/violeta consistente con la marca.
 */
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-80 shrink-0 border-r border-violet-100 bg-gradient-to-b from-white via-[#fbf8ff] to-[#f4efff] px-6 py-6 shadow-sm lg:block">
      <div className="mb-8 rounded-[2rem] border border-violet-100 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-200">
            <Landmark className="h-7 w-7" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
              Lopest
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Cartera
            </h1>
          </div>
        </div>
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
                "group flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-bold transition",
                isActive
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-200"
                  : "text-slate-700 hover:bg-white hover:text-violet-800 hover:shadow-sm",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition",
                  isActive
                    ? "bg-white/18 text-white"
                    : "bg-violet-50 text-violet-700 group-hover:bg-violet-100",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
              </span>

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
