import { CASA_NEGOCIO_HREF } from "../shell/rail-items";
import type { CnIdentity } from "../types";

/**
 * Tabs of the module, in the order and grouping of spec §4:
 * to look (Tablero · Resumen) │ to write down (Casa · Negocio · Ahorro ·
 * Arqueo) │ Configuración. Casa, Negocio and Ahorro carry their identity dot.
 */
export type CasaNegocioTab = "tablero" | "resumen" | "casa" | "negocio" | "ahorro" | "arqueo" | "configuracion";

export interface TabDef {
  id: CasaNegocioTab;
  label: string;
  href: string;
  identity?: CnIdentity;
}

export const CASA_NEGOCIO_TAB_GROUPS: readonly (readonly TabDef[])[] = [
  [
    { id: "tablero", label: "Tablero", href: CASA_NEGOCIO_HREF },
    { id: "resumen", label: "Resumen", href: `${CASA_NEGOCIO_HREF}/resumen` },
  ],
  [
    { id: "casa", label: "Casa", href: `${CASA_NEGOCIO_HREF}/casa`, identity: "casa" },
    { id: "negocio", label: "Negocio", href: `${CASA_NEGOCIO_HREF}/negocio`, identity: "negocio" },
    { id: "ahorro", label: "Ahorro", href: `${CASA_NEGOCIO_HREF}/ahorro`, identity: "ahorro" },
    { id: "arqueo", label: "Arqueo", href: `${CASA_NEGOCIO_HREF}/arqueo` },
  ],
  [{ id: "configuracion", label: "Configuración", href: `${CASA_NEGOCIO_HREF}/configuracion` }],
];

export const CASA_NEGOCIO_TABS: readonly TabDef[] = CASA_NEGOCIO_TAB_GROUPS.flat();
