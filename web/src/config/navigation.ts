/**
 * Configuración central de navegación del dashboard.
 *
 * No se deben hardcodear enlaces en cada sidebar o layout.
 * Si mañana cambia una ruta, se cambia aquí.
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
    label: "Nuevo crédito",
    href: "/creditos/nuevo",
    description: "Flujo formal de creación con vista previa.",
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