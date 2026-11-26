/**
 * PUBLIC API FOR THE TABS of Casa y Negocio: how a tab gets the active month,
 * its data, the engine's results and the common header.
 *
 * ```tsx
 * // app/(casa-negocio)/casa-negocio/<tab>/page.tsx
 * import { ModulePage } from "@/components/casa-negocio/module-page";
 * import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
 *
 * export default async function CasaPage({ searchParams }: PaginaModuloProps) {
 *   const vista = await cargarVistaMes(searchParams);
 *   // vista.mes        "2026-12" (from ?mes=AAAA-MM, today's month by default)
 *   // vista.datos      CasaNegocioMes of that month (features/casa-negocio/types.ts)
 *   // vista.calculo    engine results: negocio, casa, fijos, sobres, flujo, agenda
 *   // vista.avisos     evaluated alerts (saved config applied); filter by `vistas`
 *   // vista.puede      capabilities: { anotar, contar, configurar }
 *   return <ModulePage header={encabezadoModulo(vista, "casa")}>…</ModulePage>;
 * }
 * ```
 *
 * WHY HERE AND NOT IN THE LAYOUT. Next.js layouts receive no `searchParams`
 * and are not re-rendered when only the query changes, so a header built in
 * `layout.tsx` could neither know `?mes=` nor follow the month arrows. The
 * layout keeps the authorization gate (`casa_negocio.ver`, see
 * `app/(casa-negocio)/layout.tsx`); each page builds its header with
 * `encabezadoModulo`, which is the same for every tab. `cargarVistaMes` is
 * wrapped in React `cache`, so any number of calls in one request (page,
 * nested server components) load and evaluate the month once.
 *
 * Every read demands `casa_negocio.ver` on the server (`obtenerCasaNegocioMes`).
 * Links between tabs keep the month: use `hrefPestana(tab, mes, mesHoy)`.
 */
import { cache } from "react";

import { anotarMovimientoAction } from "@/features/casa-negocio/anotar-actions";
import { fechaClave } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes } from "@/features/casa-negocio/types";
import type { Aviso, MesCalculado } from "@/features/casa-negocio/domain";
import type { ModuleHeaderProps } from "@/components/casa-negocio/header/module-header";
import type { CasaNegocioTab } from "@/components/casa-negocio/header/tabs";

import { obtenerCasaNegocioMes } from "./queries";
import { aplanarConsulta, construirEncabezado, resolverMes, type ConsultaPagina } from "./vista-encabezado";
import { evaluarMes, type MesEvaluado } from "./vista-mes";

export { hrefPestana } from "./vista-encabezado";

/** Props Next.js gives every tab page. */
export interface PaginaModuloProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export interface VistaMes {
  mes: string;
  /** Today in Bogota, `YYYY-MM-DD`. */
  hoy: string;
  datos: CasaNegocioMes;
  calculo: MesCalculado;
  avisos: Aviso[];
  evaluado: MesEvaluado;
  puede: { anotar: boolean; contar: boolean; configurar: boolean };
  /** The page's query, flattened (first value of repeated keys). */
  consulta: ConsultaPagina;
}

/** Loads and evaluates one month (keyed by the requested `mes`; once per request). */
const cargarMes = cache(async (mesPedido: string | undefined) => {
  const mes = resolverMes(mesPedido, fechaClave(new Date()));
  const datos = await obtenerCasaNegocioMes(mes);
  return { datos, evaluado: evaluarMes(datos) };
});

/** The active month of a tab, its data and the engine's results. */
export async function cargarVistaMes(searchParams: PaginaModuloProps["searchParams"]): Promise<VistaMes> {
  const consulta = aplanarConsulta(await searchParams);
  const { datos, evaluado } = await cargarMes(consulta.mes);
  const capacidades = new Set(datos.usuario.capacidades);
  return {
    mes: datos.mes,
    hoy: datos.hoy,
    datos,
    calculo: evaluado.calculo,
    avisos: evaluado.avisos,
    evaluado,
    puede: { anotar: capacidades.has("ANOTAR"), contar: capacidades.has("CONTAR"), configurar: capacidades.has("CONFIGURAR") },
    consulta,
  };
}

/** The common header of a tab, with «Anotar» wired to its Server Action. */
export function encabezadoModulo(vista: VistaMes, tab: CasaNegocioTab): ModuleHeaderProps {
  const header = construirEncabezado({ datos: vista.datos, evaluado: vista.evaluado, tab, consulta: vista.consulta });
  return header.quickEntry ? { ...header, quickEntry: { ...header.quickEntry, action: anotarMovimientoAction } } : header;
}
