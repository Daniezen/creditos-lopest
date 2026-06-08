"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark, Rocket, ShieldCheck } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";

/**
 * Sidebar principal del dashboard.
 *
 * Usa acento lila/violeta para conservar continuidad visual con el sistema
 * anterior, pero con una estructura de dashboard más limpia.
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
          Dashboard
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Plataforma financiera para simulación, gestión y seguimiento de
          créditos.
        </p>
      </div>

      <nav className="space-y-2">
        {dashboardNavigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="cursor-not-allowed rounded-2xl px-4 py-3 opacity-50"
                title="Módulo pendiente"
              >
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {item.label}
                    </p>

                    {item.description ? (
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block rounded-2xl px-4 py-3 transition",
                isActive
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
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
                  <p className="text-sm font-semibold">{item.label}</p>

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

      <div className="mt-10 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 ring-1 ring-violet-200">
            <Rocket className="h-4 w-4" />
          </div>

          <div>
            <p className="font-semibold text-violet-900">Fase actual</p>

            <p className="mt-2 leading-6 text-violet-800">
              Simulador, wizard de creación y despliegue VPS antes de
              persistencia definitiva.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
            <ShieldCheck className="h-4 w-4" />
          </div>

          <div>
            <p className="font-semibold text-slate-900">Modo protegido</p>
            <p className="mt-2 leading-6 text-slate-500">
              No exponeremos datos reales sin control de acceso.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}