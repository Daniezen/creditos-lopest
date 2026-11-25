import type { LucideIcon } from "lucide-react";
import { House } from "lucide-react";

import { dashboardNavigation, type DashboardNavItem } from "@/config/navigation";

/**
 * Destinations of the Casa y Negocio rail (`Sidebar.dc.html`) and of its
 * mobile bottom bar (`TableroMovil.dc.html`).
 *
 * SOURCE OF TRUTH. The destinations are the current app sidebar's
 * (`config/navigation.ts`) plus «Casa y Negocio»; this file only adds the
 * rail's short label and the canvas icon for each href. A module added to the
 * app sidebar tomorrow appears in the rail with its own lucide icon and full
 * label until it gets a canvas glyph here, so the two navigations cannot
 * drift apart.
 *
 * Authorization is not decided here: every destination keeps its own server
 * guard, exactly as with the app sidebar.
 */

export const CASA_NEGOCIO_HREF = "/casa-negocio";

export interface RailItem {
  href: string;
  /** Full name, for assistive technology. */
  label: string;
  /** Name under the icon (the canvas uses short words). */
  shortLabel: string;
  /** Canvas glyph (24×24, stroke), or null to draw `icon` instead. */
  glyph: string | null;
  icon: LucideIcon;
}

/** Canvas glyphs and short labels by href, copied from `Sidebar.dc.html`. */
const CANVAS: Record<string, { shortLabel: string; glyph: string }> = {
  "/simulador": {
    shortLabel: "Simulador",
    glyph: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2",
  },
  "/clientes": {
    shortLabel: "Clientes",
    glyph: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8",
  },
  "/creditos": {
    shortLabel: "Créditos",
    glyph: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v4M18 10v4",
  },
  "/transferencias": { shortLabel: "Transferir", glyph: "M7 7h13l-3-3M17 17H4l3 3" },
  "/reportes": { shortLabel: "Reportes", glyph: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  [CASA_NEGOCIO_HREF]: { shortLabel: "Casa y Negocio", glyph: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M10 21v-6h4v6" },
};

/** Glyph of the «Más» entry of the mobile bar and of the rail's sign-out. */
export const MORE_GLYPH = "M5 12h.01M12 12h.01M19 12h.01";
export const SIGN_OUT_GLYPH = "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9";

const CASA_NEGOCIO_NAV: DashboardNavItem = {
  label: "Casa y Negocio",
  href: CASA_NEGOCIO_HREF,
  icon: House,
};

/** Rail destinations: the app sidebar's, in its order, then Casa y Negocio. */
export function buildRailItems(navigation: readonly DashboardNavItem[] = dashboardNavigation): RailItem[] {
  return [...navigation.filter((item) => !item.disabled), CASA_NEGOCIO_NAV].map((item) => {
    const canvas = CANVAS[item.href];
    return {
      href: item.href,
      label: item.label,
      shortLabel: canvas?.shortLabel ?? item.label,
      glyph: canvas?.glyph ?? null,
      icon: item.icon,
    };
  });
}

/** An item is active on its own page and on any page below it. */
export function isRailItemActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The mobile bar shows four destinations plus «Más» (`TableroMovil.dc.html`):
 * Clientes, Créditos, Casa and Reportes; everything else goes into «Más».
 */
const MOBILE_PRIMARY: readonly string[] = ["/clientes", "/creditos", CASA_NEGOCIO_HREF, "/reportes"];
const MOBILE_SHORT: Record<string, string> = { [CASA_NEGOCIO_HREF]: "Casa" };

export function splitMobileItems(items: readonly RailItem[]): { primary: RailItem[]; more: RailItem[] } {
  const primary = MOBILE_PRIMARY.map((href) => items.find((item) => item.href === href))
    .filter((item): item is RailItem => Boolean(item))
    .map((item) => ({ ...item, shortLabel: MOBILE_SHORT[item.href] ?? item.shortLabel }));
  const more = items.filter((item) => !MOBILE_PRIMARY.includes(item.href));
  return { primary, more };
}
