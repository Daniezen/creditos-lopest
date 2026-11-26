import type { Metadata } from "next";

import { CasaTab } from "@/components/casa-negocio/casa/casa-tab";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { construirVistaCasa } from "@/server/casa-negocio/vista-casa";

export const metadata: Metadata = { title: "Casa · Casa y Negocio" };

/**
 * Casa tab. The layout already gates `casa_negocio.ver`, and the read inside
 * `cargarVistaMes` checks it again on the server; the view model decides
 * read-only from `casa_negocio.anotar`. `?categoria=<id>` (the «Pagar» link of
 * a month mark) starts the form on that fixed expense.
 */
export default async function CasaPage({ searchParams }: PaginaModuloProps) {
  const vista = await cargarVistaMes(searchParams);
  return (
    <ModulePage header={encabezadoModulo(vista, "casa")}>
      <CasaTab vista={construirVistaCasa(vista.datos)} fijoInicial={vista.consulta.categoria} />
    </ModulePage>
  );
}
