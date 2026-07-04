"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Landmark, UserPlus } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";
import { LogoutButton } from "./logout-button";

export function DashboardSidebar() {
  const pathname = usePathname();
  const isReportsRoute = pathname.startsWith("/reportes");

  return (
    <aside
      className={[
        "hidden h-screen shrink-0 border-r border-violet-100 bg-white transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:flex-col",
        isReportsRoute ? "w-[92px]" : "w-[330px]",
      ].join(" ")}
    >
      <div className={["border-b border-violet-100", isReportsRoute ? "px-4 py-6" : "px-7 py-7"].join(" ")}>
        <Link href="/creditos" className={["flex items-center", isReportsRoute ? "justify-center" : "gap-4"].join(" ")} title="Créditos Lopest">
          <div className={["flex shrink-0 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100", isReportsRoute ? "h-14 w-14" : "h-16 w-16"].join(" ")}>
            <Landmark className={isReportsRoute ? "h-7 w-7" : "h-8 w-8"} />
          </div>
          {!isReportsRoute ? (
            <div>
              <p className="text-2xl font-black tracking-tight text-violet-950">Créditos</p>
              <p className="text-xl font-medium tracking-tight text-violet-700">Lopest</p>
            </div>
          ) : null}
        </Link>
      </div>

      {!isReportsRoute ? (
        <section className="border-b border-violet-100 px-5 py-5">
          <p className="mb-3 px-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Crear</p>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/creditos/nuevo" label="Crédito" icon={CreditCard} active={pathname.startsWith("/creditos/nuevo")} />
            <QuickAction href="/clientes/nuevo" label="Cliente" icon={UserPlus} active={pathname.startsWith("/clientes/nuevo")} />
          </div>
        </section>
      ) : null}

      <nav className={["min-h-0 flex-1 overflow-y-auto py-6", isReportsRoute ? "px-3" : "px-5"].join(" ")}>
        {!isReportsRoute ? (
          <p className="mb-4 px-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Navegación</p>
        ) : null}
        <div className="space-y-2">
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={[
                  "group flex items-center rounded-2xl text-sm font-semibold transition",
                  isReportsRoute ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                  isActive ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100" : "text-violet-950 hover:bg-violet-50 hover:text-violet-700",
                ].join(" ")}
              >
                <Icon className={["h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-violet-700"].join(" ")} />
                {!isReportsRoute ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {!isReportsRoute ? (
        <div className="border-t border-violet-100 px-5 py-5"><LogoutButton /></div>
      ) : null}
    </aside>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}

function QuickAction({ href, label, icon: Icon, active }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={[
        "flex min-h-20 flex-col justify-between rounded-2xl border p-3 text-sm font-semibold transition",
        active ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100" : "border-violet-100 bg-violet-50/70 text-violet-950 hover:border-violet-200 hover:bg-violet-100",
      ].join(" ")}
    >
      <Icon className={["h-5 w-5", active ? "text-white" : "text-violet-700"].join(" ")} />
      <span>{label}</span>
    </Link>
  );
}
