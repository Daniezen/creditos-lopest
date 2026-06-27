"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
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

/**
 * Topbar principal del dashboard Lopest.
 *
 * Cambio de diseño:
 * - La topbar absorbe parte de la personalidad visual que antes estaba repetida
 *   dentro de cada vista mediante cards tipo hero.
 * - Cada sección tiene un ícono contextual, evitando repetir títulos internos.
 * - La barra inferior conserva identidad Lopest: violeta/fucsia/ámbar, sin copiar
 *   la firma multicolor de Impulsa.
 *
 * Responsabilidad:
 * - Mostrar contexto global de la sección.
 * - Mostrar usuario autenticado y rol principal.
 *
 * No responsabilidad:
 * - No decide permisos.
 * - No filtra datos.
 * - No reemplaza guards, queries ni server actions.
 */
export function DashboardTopbar({ user }: DashboardTopbarProps) {
  const pathname = usePathname();

  const section = useMemo(() => getSectionMetadata(pathname), [pathname]);
  const primaryRole = getPrimaryRole(user.roles);
  const initials = getInitials(user.nombre || user.email);
  const SectionIcon = section.icon;

  return (
    <header className="sticky top-0 z-30 border-b border-violet-100 bg-white/95 backdrop-blur">
      <div className="flex min-h-[92px] items-center justify-between gap-6 bg-[radial-gradient(circle_at_top_left,#f3e8ff_0%,#fff7ed_46%,#ffffff_88%)] px-6 py-4 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/85 text-violet-700 shadow-sm shadow-violet-100 ring-1 ring-violet-100">
            <SectionIcon className="h-7 w-7" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black uppercase tracking-[0.28em] text-violet-800">
              {section.title}
            </p>

            <p className="mt-2 max-w-2xl truncate text-sm font-medium text-slate-500">
              {section.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-violet-100 bg-white text-slate-500 shadow-sm transition hover:bg-violet-50 hover:text-violet-700 sm:flex"
            aria-label="Notificaciones"
          >
            <Bell className="h-5 w-5" />
          </button>

          <div className="h-10 w-px bg-violet-100" />

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="max-w-[220px] truncate text-sm font-black uppercase tracking-wide text-violet-950">
                {user.nombre || user.email}
              </p>

              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {primaryRole}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 text-base font-black text-white shadow-lg shadow-violet-100">
              {initials}
            </div>
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-[linear-gradient(90deg,#7c3aed_0%,#a855f7_42%,#d946ef_72%,#f59e0b_100%)]" />
    </header>
  );
}

/**
 * Mapa de secciones del dashboard.
 *
 * Esta función evita que cada vista repita un hero con el mismo título.
 * La topbar queda como fuente única de contexto visual.
 */
function getSectionMetadata(pathname: string): SectionMetadata {
  if (pathname.startsWith("/creditos/nuevo")) {
    return {
      title: "Nuevo crédito",
      description: "Creación formal de créditos y cronograma inicial.",
      icon: PlusCircle,
    };
  }

  if (pathname.startsWith("/creditos")) {
    return {
      title: "Cartera",
      description: "Consulta, seguimiento y administración de créditos.",
      icon: CreditCard,
    };
  }

  if (pathname.startsWith("/clientes")) {
    return {
      title: "Clientes",
      description: "Gestión de clientes, datos de contacto y cartera asociada.",
      icon: Users,
    };
  }

  if (pathname.startsWith("/simulador")) {
    return {
      title: "Simulador",
      description: "Evaluación previa de condiciones y cronogramas de crédito.",
      icon: Calculator,
    };
  }

  if (pathname.startsWith("/analytics")) {
    return {
      title: "Analytics",
      description: "Indicadores operativos y financieros de la cartera.",
      icon: BarChart3,
    };
  }

  return {
    title: "Dashboard",
    description: "Resumen operativo de Créditos Lopest.",
    icon: BarChart3,
  };
}

function getPrimaryRole(roles: string[]): string {
  if (roles.includes("ADMIN")) {
    return "ADMIN";
  }

  if (roles.includes("OPERADOR")) {
    return "OPERADOR";
  }

  if (roles.includes("LECTURA")) {
    return "LECTURA";
  }

  return "USUARIO";
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}
