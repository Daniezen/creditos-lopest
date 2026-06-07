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
}

export const dashboardNavigation: DashboardNavItem[] = [
  {
    label: "Simulador de créditos",
    href: "/simulador",
    description: "Cronogramas, intereses, capital y saldo proyectado.",
  },
  {
    label: "Créditos",
    href: "/creditos",
    description: "Biblioteca y gestión de créditos.",
  },
  {
    label: "Clientes",
    href: "/clientes",
    description: "Perfiles, contacto y documentos.",
  },
  {
    label: "Analytics",
    href: "/analytics",
    description: "Panel analítico embebido más adelante.",
  },
];