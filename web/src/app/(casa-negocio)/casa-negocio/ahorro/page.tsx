import type { Metadata } from "next";

import { AhorroView } from "@/components/casa-negocio/ahorro/ahorro-view";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { construirVistaAhorro, obtenerCierresAhorro } from "@/server/casa-negocio/vista-ahorro";

import { pasarCierreAlAhorroAction } from "./actions";

export const metadata: Metadata = { title: "Ahorro · Casa y Negocio" };

/** Ahorro tab for the active month (`?mes=AAAA-MM`). Errors go to `error.tsx`. */
export default async function AhorroPage({ searchParams }: PaginaModuloProps) {
  const [vista, cierres] = await Promise.all([cargarVistaMes(searchParams), obtenerCierresAhorro()]);
  return (
    <ModulePage header={encabezadoModulo(vista, "ahorro")}>
      <AhorroView vista={construirVistaAhorro(vista.datos, cierres)} pasar={pasarCierreAlAhorroAction} />
    </ModulePage>
  );
}
