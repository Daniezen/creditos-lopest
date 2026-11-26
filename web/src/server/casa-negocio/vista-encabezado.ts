/**
 * View model of the common header of Casa y Negocio (`ModuloTabs.dc.html`):
 * month title and navigation, the month line, «Anotar» and its options.
 *
 * PURE MODULE (no Prisma, no NextAuth): it maps one evaluated month
 * (`CasaNegocioMes` + the engine's `MesEvaluado`) to `ModuleHeaderProps`.
 * The loader and the public API for the tabs are in `pagina.ts`.
 */
import { nombreMes, sumarMeses, type EventoAgenda } from "@/features/casa-negocio/domain";
import { PREFIJO_CUENTA } from "@/features/casa-negocio/anotar";
import { parseMes } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes } from "@/features/casa-negocio/types";
import type { ModuleHeaderProps } from "@/components/casa-negocio/header/module-header";
import { PREFILL_PARAM, prefillFromParams, type QuickEntryPrefill } from "@/components/casa-negocio/header/quick-entry";
import { CASA_NEGOCIO_TABS, type CasaNegocioTab } from "@/components/casa-negocio/header/tabs";
import { formatMillions, formatMoney } from "@/components/casa-negocio/shared/format";
import type { CnAction, MonthLineData, MonthMark, MonthMarkKind, QuickEntryOptions, QuickOption } from "@/components/casa-negocio/types";

import { reglaActiva, type MesEvaluado } from "./vista-mes";

/** Search params of a tab, already awaited and flattened (first value wins). */
export type ConsultaPagina = Record<string, string | undefined>;

/** How far ahead the arrows go: the projection of what is still to collect. */
export const MESES_ADELANTE = 12;

export function aplanarConsulta(params: Record<string, string | string[] | undefined>): ConsultaPagina {
  const out: ConsultaPagina = {};
  for (const [key, value] of Object.entries(params)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}

/** The month a tab shows: `?mes=AAAA-MM` when it is a real month, otherwise today's. */
export function resolverMes(param: string | undefined, hoy: string): string {
  return param && parseMes(param) ? param : hoy.slice(0, 7);
}

/** Link to a tab for a month; today's month needs no parameter. */
export function hrefPestana(tab: CasaNegocioTab, mes: string, mesHoy: string, extra: Record<string, string> = {}): string {
  const base = CASA_NEGOCIO_TABS.find((t) => t.id === tab)!.href;
  const query = new URLSearchParams();
  if (mes !== mesHoy) query.set("mes", mes);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/**
 * Arrow bounds: nothing before the module's first month (the accounts'
 * opening), nothing past the projection horizon.
 */
export function navegacionMes(mes: string, mesHoy: string, inicioModulo: string | null) {
  const minimo = inicioModulo ? inicioModulo.slice(0, 7) : null;
  const maximo = sumarMeses(mesHoy, MESES_ADELANTE);
  const anterior = sumarMeses(mes, -1);
  const siguiente = sumarMeses(mes, 1);
  return {
    anterior: minimo && anterior < minimo ? null : anterior,
    siguiente: siguiente > maximo ? null : siguiente,
  };
}

const capitalizar = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ---------------------------------------------------------------------------
// Actions of the detail windows (line and calendar)
// ---------------------------------------------------------------------------

/** Prefilled «Anotar» for a fixed expense: opens the panel on the same tab. */
export function hrefPagarFijo(tab: CasaNegocioTab, mes: string, mesHoy: string, fijoId: string, monto: number): string {
  return hrefPestana(tab, mes, mesHoy, { [PREFILL_PARAM]: "gastoCasa", categoria: fijoId, monto: String(Math.round(monto)) });
}

/** Where cuotas are collected: Créditos (outside the module, not redesigned yet). */
export const HREF_CUOTAS = "/creditos";

export function accionDeEvento(
  evento: EventoAgenda,
  contexto: { tab: CasaNegocioTab; mes: string; mesHoy: string },
  etiquetas: { pagar: string; cuotas: string; ahorro: string },
): CnAction | undefined {
  switch (evento.accion) {
    case "PAGAR":
      return evento.refs[0]
        ? { label: etiquetas.pagar, href: hrefPagarFijo(contexto.tab, contexto.mes, contexto.mesHoy, evento.refs[0], evento.monto) }
        : undefined;
    case "VER_CUOTAS":
      return { label: etiquetas.cuotas, href: HREF_CUOTAS };
    case "IR_A_AHORRO":
      return { label: etiquetas.ahorro, href: hrefPestana("ahorro", contexto.mes, contexto.mesHoy) };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Month line
// ---------------------------------------------------------------------------

/** Engine event → mark kind. Cash already collected is the calendar's, not the line's. */
export function tipoDeMarca(evento: EventoAgenda): MonthMarkKind | null {
  switch (evento.tipo) {
    case "COBRO_HECHO":
      return null;
    case "COBRO_ESPERADO":
      return evento.estado === "SIN_PAGAR" ? "vencido" : "viene";
    case "PAGO_CASA":
      return evento.estado === "HECHO" ? "pagado" : "viene";
    case "SIN_PAGAR":
      return "vencido";
    case "RETIRO":
      return "entrada";
    case "CIERRE":
      return "cierre";
  }
}

export function periodoDe(mes: string, mesHoy: string): MonthLineData["period"] {
  return mes < mesHoy ? "pasado" : mes > mesHoy ? "futuro" : "actual";
}

function resumenLinea(mes: string, marks: MonthMark[], today: number | null, dias: number): string {
  const contar = (kind: MonthMarkKind) => marks.filter((m) => m.kind === kind).length;
  const partes = [
    `${contar("pagado")} pagados`,
    `${contar("entrada")} entradas a la casa`,
    `${contar("viene")} por venir`,
    `${contar("vencido")} sin pagar`,
  ];
  const hoy = today === null ? "" : `; hoy es ${today}`;
  return `${capitalizar(nombreMes(mes))}: ${partes.join(", ")}${hoy}; cierre el ${dias}`;
}

export function construirLinea(
  datos: Pick<CasaNegocioMes, "mes" | "hoy">,
  evaluado: Pick<MesEvaluado, "calculo">,
  tab: CasaNegocioTab,
): MonthLineData {
  const { mes, hoy } = datos;
  const mesHoy = hoy.slice(0, 7);
  const [anio, numero] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  const today = mes === mesHoy ? Number(hoy.slice(8, 10)) : null;
  const contexto = { tab, mes, mesHoy };

  const marks: MonthMark[] = [];
  for (const evento of evaluado.calculo.agenda.eventos) {
    const kind = tipoDeMarca(evento);
    if (!kind) continue;
    marks.push({
      id: evento.id,
      day: evento.diaDelMes,
      kind,
      label: evento.texto,
      title: evento.titulo,
      detail: evento.detalle,
      action: accionDeEvento(evento, contexto, { pagar: "Pagar", cuotas: "Ver cuotas", ahorro: "Ir a Ahorro" }),
    });
  }

  return {
    daysInMonth: dias,
    today,
    period: periodoDe(mes, mesHoy),
    monthName: nombreMes(mes),
    marks,
    summary: resumenLinea(mes, marks, today, dias),
  };
}

// ---------------------------------------------------------------------------
// «Anotar»
// ---------------------------------------------------------------------------

/** Origins stored as the movement's note (canvas wording). */
export const ORIGENES_INGRESO_CASA = ["Arriendo recibido", "Regalo", "Otro"] as const;
export const CONCEPTOS_NEGOCIO = ["Papelería", "Transporte", "Comisiones", "Otro"] as const;
export const ORIGENES_APORTE_EXTERNOS = ["Ahorros propios", "Otro"] as const;

const comoOpcion = (label: string): QuickOption => ({ value: label, label });

export function opcionesAnotar(datos: CasaNegocioMes, evaluado: MesEvaluado): QuickEntryOptions {
  const activas = datos.cuentas.filter((c) => !c.archivada);
  const opcion = (c: (typeof activas)[number]): QuickOption => ({ value: c.id, label: c.nombre });
  const negocio = activas.filter((c) => c.grupo === "NEGOCIO");
  const casa = activas.filter((c) => c.grupo === "CASA");

  // Fixed expenses still owed come first and say so (the canvas' «Funeraria · sin pagar»).
  const estadoFijo = new Map(evaluado.calculo.fijos.map((f) => [f.id, f.estado]));
  const categorias = datos.categorias
    .filter((c) => c.activa)
    .map((c) => ({ c, debe: estadoFijo.get(c.id) === "SIN_PAGAR" }))
    .sort((a, b) => Number(b.debe) - Number(a.debe) || a.c.orden - b.c.orden || a.c.nombre.localeCompare(b.c.nombre))
    .map(({ c, debe }) => ({ value: c.id, label: debe ? `${c.nombre} · sin pagar` : c.nombre }));

  return {
    categoriasCasa: categorias,
    origenesIngresoCasa: ORIGENES_INGRESO_CASA.map(comoOpcion),
    conceptosNegocio: CONCEPTOS_NEGOCIO.map(comoOpcion),
    origenesAporte: [
      ...casa.map((c) => ({ value: `${PREFIJO_CUENTA}${c.id}`, label: `Desde ${c.nombre}` })),
      ...ORIGENES_APORTE_EXTERNOS.map(comoOpcion),
    ],
    cuentasNegocio: negocio.map(opcion),
    cuentasCasa: casa.map(opcion),
    cuentasTodas: [...negocio, ...casa].map(opcion),
    saldos: Object.fromEntries(activas.map((c) => [c.id, c.saldoActual])),
    nombresCuenta: Object.fromEntries(activas.map((c) => [c.id, c.nombre])),
    avisoSinSaldo: reglaActiva(evaluado.config, "CUENTA_SIN_SALDO"),
  };
}

/** `?anotar=…` opens the panel prefilled: it is what «Pagar» in a detail window links to. */
export function prefillDe(consulta: ConsultaPagina): QuickEntryPrefill | null {
  return prefillFromParams((name) => consulta[name]);
}

// ---------------------------------------------------------------------------
// The whole header
// ---------------------------------------------------------------------------

export interface EncabezadoEntrada {
  datos: CasaNegocioMes;
  evaluado: MesEvaluado;
  tab: CasaNegocioTab;
  consulta: ConsultaPagina;
}

/**
 * The header of any tab. Without `casa_negocio.anotar` it is read-only
 * (no «Anotar», a «Solo lectura» chip, no actions in the detail windows);
 * with it but without accounts there is nothing to write into, so «Anotar»
 * is hidden until Configuración creates them.
 */
export function construirEncabezado({ datos, evaluado, tab, consulta }: EncabezadoEntrada): ModuleHeaderProps {
  const { mes, hoy } = datos;
  const mesHoy = hoy.slice(0, 7);
  const nav = navegacionMes(mes, mesHoy, datos.inicioModulo);
  const readOnly = !datos.usuario.capacidades.includes("ANOTAR");
  const hayCuentas = datos.cuentas.some((c) => !c.archivada);

  // Same figure as «Dónde está la plata»: active accounts, whole pesos.
  const total = datos.cuentas.filter((c) => !c.archivada).reduce((sum, c) => sum + Math.round(c.saldoFinMes), 0);
  const summary =
    tab === "tablero" && hayCuentas
      ? { total: formatMoney(total), detail: `en cuentas · ${formatMillions(datos.cartera.enLaCalle)} en la calle` }
      : undefined;

  return {
    active: tab,
    month: {
      title: capitalizar(nombreMes(mes)),
      year: mes.slice(0, 4),
      prevHref: nav.anterior ? hrefPestana(tab, nav.anterior, mesHoy) : null,
      nextHref: nav.siguiente ? hrefPestana(tab, nav.siguiente, mesHoy) : null,
    },
    line: construirLinea(datos, evaluado, tab),
    readOnly,
    quickEntry:
      readOnly || !hayCuentas
        ? null
        : {
            options: opcionesAnotar(datos, evaluado),
            defaultDate: hoy,
            prefill: prefillDe(consulta),
            // Where to go after saving or closing a prefilled panel: the same tab, without `anotar`.
            cleanHref: hrefPestana(tab, mes, mesHoy),
          },
    summary,
    tabQuery: mes === mesHoy ? undefined : `mes=${mes}`,
  };
}
