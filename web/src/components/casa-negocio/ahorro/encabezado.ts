import { nombreMes } from "@/features/casa-negocio/domain";
import { parseMes, sumarMeses } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes } from "@/features/casa-negocio/types";

import type { ModuleHeaderProps } from "../header/module-header";
import type { CasaNegocioTab } from "../header/tabs";
import { CASA_NEGOCIO_HREF } from "../shell/rail-items";

/**
 * Header props of the Ahorro and Arqueo tabs from the REAL month read.
 *
 * The header, its month line and the quick entry belong to the Tablero work
 * (it owns `?mes=` and the line's marks). Until that loader lands this builds
 * the honest minimum: the real month title and arrows, read-only from the
 * viewer's capabilities, the tab query kept, and a line with no marks rather
 * than the canvas' November example (which would show made-up payments in
 * any other month). Swap the call for the Tablero's builder when it exists.
 */
export function encabezadoMes(tab: TabMes, data: CasaNegocioMes): ModuleHeaderProps {
  return {
    ...encabezadoBase(tab, data.mes, data.hoy, data.inicioModulo),
    readOnly: !data.usuario.capacidades.includes("ANOTAR"),
    quickEntry: {
      options: {
        categoriasCasa: data.categorias.filter((c) => c.activa).map((c) => ({ value: c.id, label: c.nombre })),
        origenesIngresoCasa: [],
        conceptosNegocio: [],
        origenesAporte: [],
        cuentasNegocio: data.cuentas.filter((c) => c.grupo === "NEGOCIO" && !c.archivada).map((c) => ({ value: c.id, label: c.nombre })),
        cuentasCasa: data.cuentas.filter((c) => c.grupo === "CASA" && !c.archivada).map((c) => ({ value: c.id, label: c.nombre })),
      },
      defaultDate: data.hoy,
    },
  };
}

/** Header when the month could not be read (no access): month and tabs only, read-only. */
export function encabezadoSinDatos(tab: TabMes, mes: string, hoy: string): ModuleHeaderProps {
  return {
    ...encabezadoBase(tab, mes, hoy, null),
    readOnly: true,
    quickEntry: {
      options: { categoriasCasa: [], origenesIngresoCasa: [], conceptosNegocio: [], origenesAporte: [], cuentasNegocio: [], cuentasCasa: [] },
      defaultDate: hoy,
    },
  };
}

type TabMes = Extract<CasaNegocioTab, "ahorro" | "arqueo">;

function encabezadoBase(
  tab: TabMes,
  mes: string,
  hoy: string,
  inicioModulo: string | null,
): Pick<ModuleHeaderProps, "active" | "month" | "line" | "tabQuery"> {
  const partes = parseMes(mes);
  const anio = partes?.anio ?? Number(mes.slice(0, 4));
  const mesNumero = partes?.mes ?? Number(mes.slice(5, 7));
  const diasEnMes = new Date(Date.UTC(anio, mesNumero, 0)).getUTCDate();
  const mesActual = hoy.slice(0, 7);
  const period = mes < mesActual ? "pasado" : mes > mesActual ? "futuro" : "actual";
  const nombre = nombreMes(mes);
  const titulo = nombre.charAt(0).toUpperCase() + nombre.slice(1);

  const base = `${CASA_NEGOCIO_HREF}/${tab}`;
  const previo = sumarMeses(mes, -1);
  const siguiente = sumarMeses(mes, 1);
  const inicio = inicioModulo?.slice(0, 7) ?? null;

  return {
    active: tab,
    month: {
      title: titulo,
      year: String(anio),
      prevHref: inicio && previo < inicio ? null : `${base}?mes=${previo}`,
      nextHref: siguiente > mesActual ? null : `${base}?mes=${siguiente}`,
    },
    line: {
      daysInMonth: diasEnMes,
      today: period === "actual" ? Number(hoy.slice(8, 10)) : null,
      period,
      monthName: nombre,
      marks: [],
      summary: `${titulo} de ${anio}`,
    },
    tabQuery: `mes=${mes}`,
  };
}

/** `?mes=AAAA-MM` → a valid month, falling back to the current one in Bogota. */
export function mesDeBusqueda(valor: string | string[] | undefined, mesActual: string): string {
  const mes = Array.isArray(valor) ? valor[0] : valor;
  return mes && parseMes(mes) ? mes : mesActual;
}
