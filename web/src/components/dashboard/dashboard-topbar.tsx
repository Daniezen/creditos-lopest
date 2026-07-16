"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  Bell,
  Calculator,
  CreditCard,
  PlusCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

interface DashboardTopbarUser {
  nombre: string;
  email: string;
  roles: string[];
}

interface DashboardTopbarProps {
  user: DashboardTopbarUser;
}

interface SectionMetadata {
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Compact global topbar for every dashboard route. */
export function DashboardTopbar({ user }: DashboardTopbarProps) {
  const pathname = usePathname();
  const section = useMemo(() => getSectionMetadata(pathname), [pathname]);
  const primaryRole = getPrimaryRole(user.roles);
  const initials = getInitials(user.nombre || user.email);
  const SectionIcon = section.icon;

  return (
    <header className="sticky top-0 z-30 border-b border-violet-100 bg-white/95 backdrop-blur">
      <div className="flex min-h-[62px] items-center justify-between gap-3 bg-[radial-gradient(circle_at_top_left,#f3e8ff_0%,#fff7ed_46%,#ffffff_88%)] px-4 py-2 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-violet-700 shadow-sm shadow-violet-100 ring-1 ring-violet-100">
            <SectionIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-violet-800">
              {section.title}
            </p>
            <p className="mt-1 max-w-4xl truncate text-xs font-medium text-slate-500">
              {section.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-violet-100 bg-white text-slate-500 shadow-sm transition hover:bg-violet-50 hover:text-violet-700 sm:flex"
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" />
          </button>

          <div className="h-8 w-px bg-violet-100" />

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold uppercase tracking-wide text-violet-950">
                {user.nombre || user.email}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                {primaryRole}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 text-sm font-black text-white shadow-lg shadow-violet-100">
              {initials}
            </div>
          </div>
        </div>
      </div>

      <div className="h-1 bg-[linear-gradient(90deg,#7c3aed_0%,#a855f7_42%,#d946ef_72%,#f59e0b_100%)]" />
    </header>
  );
}

function getSectionMetadata(pathname: string): SectionMetadata {
  if (pathname.startsWith("/transferencias")) return { title: "Transferencias de cartera", description: "Mueve clientes completos o créditos individuales entre cuentas.", icon: ArrowRightLeft };
  if (pathname.startsWith("/creditos/nuevo")) return { title: "Nuevo crédito", description: "Creación formal de créditos y cronograma inicial.", icon: PlusCircle };
  if (pathname.startsWith("/creditos")) return { title: "Créditos", description: "Consulta, seguimiento y administración de créditos.", icon: CreditCard };
  if (pathname.startsWith("/clientes")) return { title: "Clientes", description: "Gestión de clientes, contacto y cartera asociada.", icon: Users };
  if (pathname.startsWith("/simulador")) return { title: "Simulador", description: "Evaluación de condiciones y cronogramas de crédito.", icon: Calculator };
  if (pathname.startsWith("/reportes")) return { title: "Reportes", description: "Indicadores y reportes financieros.", icon: BarChart3 };
  return { title: "Dashboard", description: "Resumen operativo de Créditos Lopest.", icon: BarChart3 };
}

function getPrimaryRole(roles: string[]): string {
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("TRANSFERENCIAS_CARTERA")) return "TRANSFERENCIAS";
  if (roles.includes("OPERADOR")) return "OPERADOR";
  if (roles.includes("LECTURA")) return "LECTURA";
  return "USUARIO";
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}
