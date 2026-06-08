import {
  BarChart3,
  Calculator,
  CreditCard,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Configuración central de navegación del dashboard.
 *
 * Regla:
 * - El sidebar solo contiene módulos principales.
 * - Acciones como "Crear nuevo crédito" viven dentro del módulo Créditos.
 */

export interface DashboardNavItem {
  label: string;
  href: string;
  description?: string;
  disabled?: boolean;
  icon: LucideIcon;
}

export const dashboardNavigation: DashboardNavItem[] = [
  {
    label: "Simulador de créditos",
    href: "/simulador",
    description: "Cronogramas, intereses, capital y saldo proyectado.",
    icon: Calculator,
  },
  {
    label: "Créditos",
    href: "/creditos",
    description: "Biblioteca y gestión de créditos.",
    icon: CreditCard,
  },
  {
    label: "Clientes",
    href: "/clientes",
    description: "Perfiles, contacto y documentos.",
    icon: Users,
  },
  {
    label: "Analytics",
    href: "/analytics",
    description: "Panel analítico embebido más adelante.",
    icon: BarChart3,
  },
];