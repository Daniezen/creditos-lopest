"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dashboardNavigation } from "@/config/navigation";

/**
 * Sidebar principal del dashboard.
 *
 * Se mantiene como componente cliente porque usa usePathname()
 * para determinar la ruta activa.
 */
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 shadow-sm lg:block">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
          Créditos Lopest
        </p>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Dashboard
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Plataforma financiera para simulación, gestión y seguimiento de
          créditos.
        </p>
      </div>

      <nav className="space-y-2">
        {dashboardNavigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="cursor-not-allowed rounded-2xl px-4 py-3 opacity-50"
                title="Módulo pendiente"
              >
                <p className="text-sm font-medium text-slate-500">
                  {item.label}
                </p>

                {item.description ? (
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {item.description}
                  </p>
                ) : null}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")}
            >
              <p className="text-sm font-semibold">{item.label}</p>

              {item.description ? (
                <p
                  className={[
                    "mt-1 text-xs leading-5",
                    isActive ? "text-emerald-50" : "text-slate-400",
                  ].join(" ")}
                >
                  {item.description}
                </p>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <p className="font-semibold text-emerald-900">Fase actual</p>

        <p className="mt-2 leading-6 text-emerald-800">
          Simulador primero. Persistencia, clientes, documentos, abonos y
          analítica después.
        </p>
      </div>
    </aside>
  );
}