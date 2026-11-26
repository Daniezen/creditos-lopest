import type { Metadata } from "next";

import { encabezadoProvisional, mesDeConsulta } from "@/components/casa-negocio/casa/encabezado-provisional";
import { SinAcceso } from "@/components/casa-negocio/casa/estados";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { NegocioTab } from "@/components/casa-negocio/negocio/negocio-tab";
import { fechaClave } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes } from "@/features/casa-negocio/types";
import { CasaNegocioPermisoError } from "@/server/casa-negocio/errors";
import { obtenerCasaNegocioMes } from "@/server/casa-negocio/queries";
import { construirVistaNegocio } from "@/server/casa-negocio/vista-negocio";

export const metadata: Metadata = { title: "Negocio · Casa y Negocio" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Negocio tab. `obtenerCasaNegocioMes` demands `casa_negocio.ver` and scopes
 * the loan rows to the viewer; balances are module-wide.
 */
export default async function NegocioPage({ searchParams }: Props) {
  const consulta = await searchParams;
  const mes = mesDeConsulta(consulta.mes, fechaClave(new Date()));
  let datos: CasaNegocioMes;
  try {
    datos = await obtenerCasaNegocioMes(mes);
  } catch (error) {
    if (error instanceof CasaNegocioPermisoError) return <SinAcceso mensaje={error.message} />;
    throw error;
  }
  return (
    <ModulePage header={encabezadoProvisional(datos, "negocio")}>
      <NegocioTab vista={construirVistaNegocio(datos)} />
    </ModulePage>
  );
}
