import type { ReactNode } from "react";

import { DashboardSidebar } from "@/components/dashboard/sidebar";

/**
 * Layout raíz del dashboard.
 *
 * Todas las páginas internas del dashboard deben vivir dentro de:
 * src/app/(dashboard)/...
 *
 * El grupo "(dashboard)" no aparece en la URL.
 * Ejemplo:
 * src/app/(dashboard)/simulador/page.tsx => /simulador
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <DashboardSidebar />

        <div className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Créditos Lopest
            </p>
            <p className="mt-1 text-lg font-bold text-slate-950">Dashboard</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}