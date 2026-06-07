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
    disabled: true,
  },
  {
    label: "Clientes",
    href: "/clientes",
    description: "Perfiles, contacto y documentos.",
    disabled: true,
  },
  {
    label: "Documentos",
    href: "/documentos",
    description: "Adjuntos y trazabilidad documental.",
    disabled: true,
  },
  {
    label: "Data Studio",
    href: "/analytics",
    description: "Panel analítico embebido más adelante.",
    disabled: true,
  },
];