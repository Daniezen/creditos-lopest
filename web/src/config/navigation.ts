import {
  ArrowRightLeft,
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
 * - El sidebar contiene módulos principales.
 * - Las reglas de autorización viven en las rutas/acciones de servidor.
 * - Transferencias se muestra como módulo; usuarios sin permiso quedan
 *   bloqueados por el guard de /transferencias.
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
    label: "Transferencias",
    href: "/transferencias",
    description: "Mover clientes completos o créditos individuales entre cuentas.",
    icon: ArrowRightLeft,
  },
  {
    label: "Reportes",
    href: "/reportes",
    description: "Panel de reportes e indicadores financieros.",
    icon: BarChart3,
  },
];
