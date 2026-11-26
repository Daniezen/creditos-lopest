import type { Metadata } from "next";

import { Configuracion, ConfiguracionAviso } from "@/components/casa-negocio/configuracion/configuracion";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { CasaNegocioPermisoError } from "@/server/casa-negocio/errors";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { obtenerVistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

export const metadata: Metadata = { title: "Configuración · Casa y Negocio" };

/**
 * Configuración tab with live data. Anyone with `casa_negocio.ver` sees it;
 * only `casa_negocio.configurar` gets the editing controls, and every action
 * re-checks that capability on the server.
 */
export default async function ConfiguracionPage({ searchParams }: PaginaModuloProps) {
  const header = encabezadoModulo(await cargarVistaMes(searchParams), "configuracion");
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
