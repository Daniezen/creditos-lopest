import type { Metadata } from "next";

import { ArqueoView } from "@/components/casa-negocio/arqueo/arqueo-view";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { construirVistaArqueo } from "@/server/casa-negocio/vista-arqueo";

import { guardarArqueoAction } from "./actions";

export const metadata: Metadata = { title: "Arqueo · Casa y Negocio" };

/**
 * Arqueo tab with real balances. The month in `?mes=` only drives the
 * header: an arqueo always counts what is in each account now.
 */
export default async function ArqueoPage({ searchParams }: PaginaModuloProps) {
  const vista = await cargarVistaMes(searchParams);
  const arqueo = construirVistaArqueo(vista.datos);
  return (
    <ModulePage header={encabezadoModulo(vista, "arqueo")}>
      <ArqueoView vista={arqueo} guardar={arqueo.puedeContar ? guardarArqueoAction : undefined} />
    </ModulePage>
  );
}
