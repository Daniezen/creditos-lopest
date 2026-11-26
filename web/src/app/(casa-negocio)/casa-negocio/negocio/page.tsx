import type { Metadata } from "next";

import { ModulePage } from "@/components/casa-negocio/module-page";
import { NegocioTab } from "@/components/casa-negocio/negocio/negocio-tab";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { construirVistaNegocio } from "@/server/casa-negocio/vista-negocio";

export const metadata: Metadata = { title: "Negocio · Casa y Negocio" };

/**
 * Negocio tab. The month read demands `casa_negocio.ver` and scopes the loan
 * rows to the viewer; balances are module-wide.
 */
export default async function NegocioPage({ searchParams }: PaginaModuloProps) {
  const vista = await cargarVistaMes(searchParams);
  return (
    <ModulePage header={encabezadoModulo(vista, "negocio")}>
      <NegocioTab vista={construirVistaNegocio(vista.datos)} />
    </ModulePage>
  );
}
