import type { Metadata } from "next";

import { encabezadoMes, encabezadoSinDatos, mesDeBusqueda } from "@/components/casa-negocio/ahorro/encabezado";
import { EstadoTab } from "@/components/casa-negocio/ahorro/estado";
import { ArqueoView } from "@/components/casa-negocio/arqueo/arqueo-view";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { fechaClave, mesClave } from "@/features/casa-negocio/mes";
import { CasaNegocioPermisoError } from "@/server/casa-negocio/errors";
import { obtenerCasaNegocioMes } from "@/server/casa-negocio/queries";
import { construirVistaArqueo } from "@/server/casa-negocio/vista-arqueo";

import { guardarArqueoAction } from "./actions";

export const metadata: Metadata = { title: "Arqueo · Casa y Negocio" };

/**
 * Arqueo tab with real balances. The month in `?mes=` only drives the
 * header: an arqueo always counts what is in each account now.
 */
export default async function ArqueoPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const ahora = new Date();
  const mes = mesDeBusqueda((await searchParams).mes, mesClave(ahora));

  const data = await obtenerCasaNegocioMes(mes).catch((error: unknown) => {
    if (error instanceof CasaNegocioPermisoError) return error;
    throw error;
  });
  if (data instanceof CasaNegocioPermisoError) {
    return (
      <ModulePage header={encabezadoSinDatos("arqueo", mes, fechaClave(ahora))}>
        <EstadoTab titulo="Sin acceso" texto={data.message} role="alert" />
      </ModulePage>
    );
  }

  const vista = construirVistaArqueo(data);
  return (
    <ModulePage header={encabezadoMes("arqueo", data)}>
      <ArqueoView vista={vista} guardar={vista.puedeContar ? guardarArqueoAction : undefined} />
    </ModulePage>
  );
}
