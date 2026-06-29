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
 * - Acciones como crear cliente o crear crédito viven en accesos rápidos
 *   o dentro del módulo correspondiente.
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
    label: "Clientes",
    href: "/clientes",
    description: "Perfiles, contacto y documentos.",
    icon: Users,
  },
  {
    label: "Créditos",
    href: "/creditos",
    description: "Biblioteca y gestión de créditos.",
    icon: CreditCard,
  },
  {
    label: "Reportes",
    href: "/analytics",
    description: "Panel de reportes e indicadores financieros.",
    icon: BarChart3,
  },
];
