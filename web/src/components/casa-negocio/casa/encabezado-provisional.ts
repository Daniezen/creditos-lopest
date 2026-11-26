/**
 * PROVISIONAL header of the Casa and Negocio pages, until the Tablero
 * session publishes the module's real one (`encabezadoModulo` and
 * `cargarVistaMes` in `server/casa-negocio/pagina.ts`). It follows the same
 * conventions — the month comes from `?mes=AAAA-MM` (today's by default),
 * the tabs keep it in the query — but draws an empty month line and leaves
 * «Anotar» without a save action. Swapping it is two lines in each page.
 */
import { diasDelMes, parseMes, sumarMeses } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes } from "@/features/casa-negocio/types";
import { nombreDelMes } from "@/server/casa-negocio/vista-casa";

import type { ModuleHeaderProps } from "../header/module-header";
import type { CasaNegocioTab } from "../header/tabs";
import { CASA_NEGOCIO_TABS } from "../header/tabs";

/** The month a tab shows: `?mes=AAAA-MM` when it is a real month, otherwise today's. */
export function mesDeConsulta(param: string | string[] | undefined, hoy: string): string {
  const valor = Array.isArray(param) ? param[0] : param;
  return valor && parseMes(valor) ? valor : hoy.slice(0, 7);
}

function href(tab: CasaNegocioTab, mes: string, mesHoy: string): string {
  const base = CASA_NEGOCIO_TABS.find((t) => t.id === tab)!.href;
  return mes === mesHoy ? base : `${base}?mes=${mes}`;
}

export function encabezadoProvisional(datos: CasaNegocioMes, tab: CasaNegocioTab): ModuleHeaderProps {
  const mesHoy = datos.hoy.slice(0, 7);
  const { anio, mes } = parseMes(datos.mes)!;
  const nombre = nombreDelMes(datos.mes);
  const minimo = datos.inicioModulo?.slice(0, 7) ?? null;
  const anterior = sumarMeses(datos.mes, -1);
  const siguiente = sumarMeses(datos.mes, 1);
  const period = datos.mes < mesHoy ? "pasado" : datos.mes > mesHoy ? "futuro" : "actual";
  const opcion = (c: { id: string; nombre: string }) => ({ value: c.id, label: c.nombre });
  const activas = datos.cuentas.filter((c) => !c.archivada);
  return {
    active: tab,
    month: {
      title: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      year: String(anio),
      prevHref: minimo && anterior < minimo ? null : href(tab, anterior, mesHoy),
      nextHref: siguiente > sumarMeses(mesHoy, 12) ? null : href(tab, siguiente, mesHoy),
    },
    line: {
      daysInMonth: diasDelMes(anio, mes),
      today: period === "actual" ? Number(datos.hoy.slice(8, 10)) : null,
      period,
      monthName: nombre,
      marks: [],
      summary: `${nombre.charAt(0).toUpperCase() + nombre.slice(1)} de ${anio}`,
    },
    readOnly: !datos.usuario.capacidades.includes("ANOTAR"),
    quickEntry: {
      defaultDate: datos.hoy,
      options: {
        categoriasCasa: datos.categorias.filter((c) => c.activa).map(opcion),
        origenesIngresoCasa: ["Arriendo recibido", "Regalo", "Otro"].map((o) => ({ value: o, label: o })),
        conceptosNegocio: ["Papelería", "Transporte", "Comisiones", "Otro"].map((o) => ({ value: o, label: o })),
        origenesAporte: activas.filter((c) => c.grupo === "CASA").map(opcion),
        cuentasNegocio: activas.filter((c) => c.grupo === "NEGOCIO").map(opcion),
        cuentasCasa: activas.filter((c) => c.grupo === "CASA").map(opcion),
      },
    },
    tabQuery: datos.mes === mesHoy ? undefined : `mes=${datos.mes}`,
  };
}
