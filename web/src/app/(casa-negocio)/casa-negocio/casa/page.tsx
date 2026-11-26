import type { Metadata } from "next";

import { CasaTab } from "@/components/casa-negocio/casa/casa-tab";
import { encabezadoProvisional, mesDeConsulta } from "@/components/casa-negocio/casa/encabezado-provisional";
import { SinAcceso } from "@/components/casa-negocio/casa/estados";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { fechaClave } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes } from "@/features/casa-negocio/types";
import { CasaNegocioPermisoError } from "@/server/casa-negocio/errors";
import { obtenerCasaNegocioMes } from "@/server/casa-negocio/queries";
import { construirVistaCasa } from "@/server/casa-negocio/vista-casa";

export const metadata: Metadata = { title: "Casa · Casa y Negocio" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Casa tab. `obtenerCasaNegocioMes` demands `casa_negocio.ver` on the
 * server; the view model decides read-only from `casa_negocio.anotar`.
 * `?categoria=<id>` (the «Pagar» link of a month mark) starts the form on
 * that fixed expense.
 */
export default async function CasaPage({ searchParams }: Props) {
  const consulta = await searchParams;
  const mes = mesDeConsulta(consulta.mes, fechaClave(new Date()));
  let datos: CasaNegocioMes;
  try {
    datos = await obtenerCasaNegocioMes(mes);
  } catch (error) {
    if (error instanceof CasaNegocioPermisoError) return <SinAcceso mensaje={error.message} />;
    throw error;
  }
  const categoria = Array.isArray(consulta.categoria) ? consulta.categoria[0] : consulta.categoria;
  return (
    <ModulePage header={encabezadoProvisional(datos, "casa")}>
      <CasaTab vista={construirVistaCasa(datos)} fijoInicial={categoria} />
    </ModulePage>
  );
}
