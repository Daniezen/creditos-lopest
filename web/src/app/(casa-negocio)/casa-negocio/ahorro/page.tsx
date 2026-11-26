import type { Metadata } from "next";

import { AhorroView } from "@/components/casa-negocio/ahorro/ahorro-view";
import { encabezadoMes, encabezadoSinDatos, mesDeBusqueda } from "@/components/casa-negocio/ahorro/encabezado";
import { EstadoTab } from "@/components/casa-negocio/ahorro/estado";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { fechaClave, mesClave } from "@/features/casa-negocio/mes";
import { CasaNegocioPermisoError } from "@/server/casa-negocio/errors";
import { obtenerCasaNegocioMes } from "@/server/casa-negocio/queries";
import { construirVistaAhorro, obtenerCierresAhorro } from "@/server/casa-negocio/vista-ahorro";

import { pasarCierreAlAhorroAction } from "./actions";

export const metadata: Metadata = { title: "Ahorro · Casa y Negocio" };

/**
 * Ahorro tab with the real month (`?mes=AAAA-MM`, current month by default).
 * Reading demands `casa_negocio.ver`; without it the tab says so instead of
 * failing. Other errors go to `error.tsx`.
 */
export default async function AhorroPage({ searchParams }: { searchParams: Promise<{ mes?: string | string[] }> }) {
  const ahora = new Date();
  const mes = mesDeBusqueda((await searchParams).mes, mesClave(ahora));

  const leido = await Promise.all([obtenerCasaNegocioMes(mes), obtenerCierresAhorro()]).catch((error: unknown) => {
    if (error instanceof CasaNegocioPermisoError) return error;
    throw error;
  });
  if (leido instanceof CasaNegocioPermisoError) {
    return (
      <ModulePage header={encabezadoSinDatos("ahorro", mes, fechaClave(ahora))}>
        <EstadoTab titulo="Sin acceso" texto={leido.message} role="alert" />
      </ModulePage>
    );
  }

  const [data, cierres] = leido;
  return (
    <ModulePage header={encabezadoMes("ahorro", data)}>
      <AhorroView vista={construirVistaAhorro(data, cierres)} pasar={pasarCierreAlAhorroAction} />
    </ModulePage>
  );
}
