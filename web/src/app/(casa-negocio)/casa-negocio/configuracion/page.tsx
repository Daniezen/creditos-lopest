import type { Metadata } from "next";

import { Configuracion, ConfiguracionAviso } from "@/components/casa-negocio/configuracion/configuracion";
import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { CasaNegocioPermisoError } from "@/server/casa-negocio/errors";
import { obtenerVistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

export const metadata: Metadata = { title: "Configuración · Casa y Negocio" };

/**
 * Configuración tab with live data. Anyone with `casa_negocio.ver` sees it;
 * only `casa_negocio.configurar` gets the editing controls, and every action
 * re-checks that capability on the server.
 *
 * The header still comes from the canvas fixture: it belongs to the Tablero
 * work, which replaces `demoHeader` for every tab at once.
 */
export default async function ConfiguracionPage() {
  const header = demoHeader("configuracion");
  const vista = await obtenerVistaConfiguracion().catch((error: unknown) => {
    if (error instanceof CasaNegocioPermisoError) return error;
    throw error;
  });
  if (vista instanceof CasaNegocioPermisoError) {
    return (
      <ModulePage header={{ ...header, readOnly: true }}>
        <ConfiguracionAviso>{vista.message}</ConfiguracionAviso>
      </ModulePage>
    );
  }
  return (
    <ModulePage header={header}>
      <Configuracion vista={vista} />
    </ModulePage>
  );
}
