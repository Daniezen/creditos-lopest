import type { Metadata } from "next";

import { ModulePage } from "@/components/casa-negocio/module-page";
import { Resumen } from "@/components/casa-negocio/resumen/resumen";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { obtenerVistaResumen, parseRango, type RangoResumen } from "@/server/casa-negocio/vista-resumen";

export const metadata: Metadata = { title: "Resumen · Casa y Negocio" };
export const dynamic = "force-dynamic";

/**
 * Resumen tab with live data (`server/casa-negocio/vista-resumen.ts`): it
 * demands `casa_negocio.ver` and follows the viewer's loan scope, like
 * Reportes. The tab looks at the last months up to today, so it does not
 * depend on the header's month.
 */
export default async function ResumenPage({ searchParams }: PaginaModuloProps) {
  const params = await searchParams;
  const rango = parseRango(params.rango);
  const [vista, mes] = await Promise.all([obtenerVistaResumen(rango), cargarVistaMes(searchParams)]);

  const rangoHref = (r: RangoResumen) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "rango") query.set(k, v);
    if (r !== 12) query.set("rango", String(r));
    const texto = query.toString();
    return texto ? `?${texto}` : "?";
  };

  return (
    <ModulePage header={encabezadoModulo(mes, "resumen")}>
      <Resumen vista={vista} rangoHref={rangoHref} />
    </ModulePage>
  );
}
