"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Landmark, UserPlus } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";
import { LogoutButton } from "./logout-button";

/**
 * Sidebar principal de Créditos Lopest.
 *
 * Intención visual:
 * - conservar estructura sólida inspirada en Impulsa;
 * - mantener identidad Lopest con violeta/lavanda/fucsia;
 * - reemplazar el bloque decorativo por acciones reales de creación;
 * - evitar duplicar el usuario, que ya vive en la topbar.
 *
 * Comportamiento:
 * - en desktop es sticky y ocupa h-screen;
 * - la navegación interna puede scrollear si hay poco alto disponible;
 * - el botón de cierre queda al fondo.
 *
 * Seguridad:
 * - este componente solo navega;
 * - no decide permisos ni filtra datos.
 */
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-[330px] shrink-0 border-r border-violet-100 bg-white lg:sticky lg:top-0 lg:flex lg:flex-col">
      <div className="border-b border-violet-100 px-7 py-7">
        <Link href="/creditos" className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100">
            <Landmark className="h-8 w-8" />
          </div>

          <div>
            <p className="text-2xl font-black tracking-tight text-violet-950">
              Créditos
            </p>
            <p className="text-xl font-medium tracking-tight text-violet-700">
              Lopest
            </p>
          </div>
        </Link>
      </div>

      <section className="border-b border-violet-100 px-5 py-5">
        <p className="mb-3 px-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Crear
        </p>

        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            href="/creditos/nuevo"
            label="Crédito"
            icon={CreditCard}
            active={pathname.startsWith("/creditos/nuevo")}
          />

          <QuickAction
            href="/clientes/nuevo"
            label="Cliente"
            icon={UserPlus}
            active={pathname.startsWith("/clientes/nuevo")}
          />
        </div>
      </section>

      <nav className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <p className="mb-4 px-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
          Navegación
        </p>

        <div className="space-y-2">
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition",
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100"
                    : "text-violet-950 hover:bg-violet-50 hover:text-violet-700",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-5 w-5 shrink-0",
                    isActive
                      ? "text-white"
                      : "text-slate-500 group-hover:text-violet-700",
                  ].join(" ")}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-violet-100 px-5 py-5">
        <LogoutButton />
      </div>
    </aside>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}

/**
 * Acción compacta de creación.
 *
 * Se usa para tareas frecuentes, no para duplicar páginas existentes.
 */
function QuickAction({ href, label, icon: Icon, active }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={[
        "flex min-h-20 flex-col justify-between rounded-2xl border p-3 text-sm font-black transition",
        active
          ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100"
          : "border-violet-100 bg-violet-50/70 text-violet-950 hover:border-violet-200 hover:bg-violet-100",
      ].join(" ")}
    >
      <Icon
        className={["h-5 w-5", active ? "text-white" : "text-violet-700"].join(
          " ",
        )}
      />
      <span>{label}</span>
    </Link>
  );
}
