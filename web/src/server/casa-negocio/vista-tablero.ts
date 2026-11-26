/**
 * View model of the Tablero tab (`Main.dc.html`, `TableroMovil.dc.html`)
 * from one evaluated month: the engine's results (`calcularMes`) and the
 * alert evaluator with the saved configuration (`evaluarAvisos`, through
 * `vista-mes.ts`), mapped onto the presentational types of
 * `components/casa-negocio/types.ts`.
 *
 * PURE MODULE: no Prisma, no NextAuth. The page loads the month with
 * `cargarVistaMes` (`pagina.ts`) and passes it here.
 *
 * Where each alert of spec §5 shows on the Tablero (only when it applies):
 *   1 fixed expense overdue  → red ring on the line + «falta» in the calendar
 *   2 envelope near its cap  → the envelope's amber/red ring (threshold saved)
 *   3 envelopes close < 0    → under the Casa equation
 *   4 account not counted    → the account's status + today in the calendar
 *   5 count does not match   → the account's status (problem) + today
 *   6 retiros > ganancia     → under the Negocio equation
 *   8 credits without pay    → link under «En la calle»
 *   9 annual expense soon    → under the Casa equation, with «Pagar»
 *  10 leftover not saved     → under the Casa equation, with «Ir a Ahorro»
 * Rule 7 belongs to «Anotar» (before saving), not to the Tablero.
 */
import {
  calcularDineroFamilia,
  nombreMes,
  type Aviso,
  type EventoAgenda,
  type ParteFlujoId,
  type PasoFlujo,
} from "@/features/casa-negocio/domain";
import type { CasaNegocioMes, CuentaMes } from "@/features/casa-negocio/types";
import type { TableroData } from "@/components/casa-negocio/tablero/tablero";
import type { CasaNegocioTab } from "@/components/casa-negocio/header/tabs";
import { formatMoney } from "@/components/casa-negocio/shared/format";
import type {
  AccountBalance,
  AccountSwatch,
  CalendarEvent,
  CalendarEventKind,
  CnAction,
  EquationRow,
  MoneyPathData,
  NextActionData,
  NoticeLevel,
} from "@/components/casa-negocio/types";

import { HREF_CUOTAS, accionDeEvento, hrefPagarFijo, hrefPestana } from "./vista-encabezado";
import { entero, reglaActiva, type MesEvaluado } from "./vista-mes";

const TAB: CasaNegocioTab = "tablero";
const NIVEL: Record<Aviso["nivel"], NoticeLevel> = { ATENCION: "atencion", PROBLEMA: "problema" };
const capitalizar = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface Contexto {
  mes: string;
  mesHoy: string;
  hoy: string;
  esMesActual: boolean;
}

function contextoDe(datos: Pick<CasaNegocioMes, "mes" | "hoy">): Contexto {
  const mesHoy = datos.hoy.slice(0, 7);
  return { mes: datos.mes, mesHoy, hoy: datos.hoy, esMesActual: datos.mes === mesHoy };
}

const hrefArqueo = (c: Contexto) => hrefPestana("arqueo", c.mes, c.mesHoy);
const hrefAhorro = (c: Contexto) => hrefPestana("ahorro", c.mes, c.mesHoy);

// ---------------------------------------------------------------------------
// Por dónde pasó la plata
// ---------------------------------------------------------------------------

function monto(paso: PasoFlujo, id: ParteFlujoId): number {
  return paso.partes.find((p) => p.id === id)?.monto ?? 0;
}

export function caminoDeLaPlata(evaluado: Pick<MesEvaluado, "calculo">): MoneyPathData {
  const { flujo, casa } = evaluado.calculo;
  const [entro, salio] = flujo.pasos;
  return {
    entered: {
      interest: monto(entro, "intereses"),
      capitalReturned: monto(entro, "capital"),
      contributions: monto(entro, "aportes"),
      fromBefore: monto(entro, "deLoQueHabia"),
    },
    left: {
      newLoans: monto(salio, "prestamosNuevos"),
      expenses: monto(salio, "gastos"),
      toHouse: monto(salio, "aLaCasa"),
      remained: monto(salio, "quedoEnCuentas"),
    },
    house: { fixed: casa.fijos, variable: casa.variables, surplus: casa.entro - casa.fijos - casa.variables },
  };
}

/** A month in which nothing moved: no cobros, no disbursements, no manual movements. */
export function mesSinMovimientos(datos: CasaNegocioMes): boolean {
  return datos.cobros.length === 0 && datos.desembolsos.length === 0 && datos.movimientos.length === 0;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function tipoEnCalendario(evento: EventoAgenda): CalendarEventKind {
  switch (evento.tipo) {
    case "COBRO_HECHO":
      return "cobro";
    case "COBRO_ESPERADO":
      return evento.estado === "SIN_PAGAR" ? "falta" : "cobro";
    case "PAGO_CASA":
    case "RETIRO":
      return "casa";
    case "SIN_PAGAR":
      return "falta";
    case "CIERRE":
      return "ahorro";
  }
}

/** One line per event, in the canvas wording («Arriendo · pagado», «Funeraria · $ 32.000»). */
export function textoEnCalendario(evento: EventoAgenda): string {
  switch (evento.tipo) {
    case "PAGO_CASA":
      return evento.estado === "HECHO" ? `${evento.titulo} · pagado` : `${evento.titulo} · ${formatMoney(evento.monto)}`;
    case "CIERRE":
      return evento.monto > 0 ? `Pasar lo que sobre al ahorro · ${formatMoney(evento.monto)}` : evento.detalle;
    default:
      return `${evento.titulo} · ${formatMoney(evento.monto)}`;
  }
}

function calendario(datos: CasaNegocioMes, evaluado: MesEvaluado, c: Contexto): TableroData["calendar"] {
  const [anio, mes] = datos.mes.split("-").map(Number);
  const today = c.esMesActual ? Number(c.hoy.slice(8, 10)) : null;
  const days: Record<number, CalendarEvent[]> = {};
  for (const [dia, eventos] of Object.entries(evaluado.calculo.agenda.porDia)) {
    days[Number(dia)] = eventos.map((evento) => ({
      kind: tipoEnCalendario(evento),
      text: textoEnCalendario(evento),
      action: accionDeEvento(evento, { tab: TAB, mes: c.mes, mesHoy: c.mesHoy }, { pagar: "Pagar", cuotas: "Ver", ahorro: "Ahorrar" }),
    }));
  }
  // Counting alerts are about today: they go on today's cell, with «Contar».
  if (today !== null) {
    const conteo = evaluado.avisos.filter((a) => a.reglaId === "CUENTA_SIN_CONTAR" || a.reglaId === "ARQUEO_NO_CUADRA");
    if (conteo.length > 0) {
      days[today] = [
        ...(days[today] ?? []),
        ...conteo.map((a): CalendarEvent => ({ kind: "falta", text: a.texto, action: { label: "Contar", href: hrefArqueo(c) } })),
      ];
    }
  }
  return { year: anio, month: mes, monthTitle: capitalizar(nombreMes(datos.mes)), monthName: nombreMes(datos.mes), today, days };
}

// ---------------------------------------------------------------------------
// Las cuentas del mes
// ---------------------------------------------------------------------------

function avisoComoNota(aviso: Aviso, action?: CnAction) {
  return { level: NIVEL[aviso.nivel], text: aviso.texto, action };
}

const porGravedad = (a: { level: NoticeLevel }, b: { level: NoticeLevel }) =>
  (a.level === "problema" ? 0 : 1) - (b.level === "problema" ? 0 : 1);

function ecuaciones(evaluado: MesEvaluado, c: Contexto): EquationRow[] {
  const { negocio, casa } = evaluado.calculo;
  const deRegla = (regla: Aviso["reglaId"]) => evaluado.avisos.filter((a) => a.reglaId === regla);

  const notasNegocio = deRegla("RETIRO_MAYOR_GANANCIA").map((a) => avisoComoNota(a));
  const notasCasa = [
    ...deRegla("SOBRES_CIERRE_NEGATIVO").map((a) => avisoComoNota(a)),
    ...deRegla("ANUAL_POR_VENCER").map((a) =>
      avisoComoNota(a, a.refs[0] ? { label: "Pagar", href: hrefPagarFijo(TAB, c.mes, c.mesHoy, a.refs[0], a.montos.pendiente ?? 0) } : undefined),
    ),
    ...deRegla("CIERRE_SIN_AHORRO").map((a) => avisoComoNota(a, { label: "Ir a Ahorro", href: hrefAhorro(c) })),
  ].sort(porGravedad);

  return [
    {
      name: "Negocio",
      identity: "negocio",
      terms: [
        { op: "", label: "Intereses", amount: negocio.intereses },
        { op: "−", label: "Gastos", amount: negocio.gastos },
        { op: "−", label: "Perdidos", amount: negocio.perdidos },
        { op: "=", label: "Ganancia", amount: negocio.ganancia, result: true },
        { op: "−", label: "A la casa", amount: negocio.retirosCasa },
        { op: "=", label: "Reinvertido", amount: negocio.reinvertido, result: true },
      ],
      notices: notasNegocio.length ? notasNegocio : undefined,
    },
    {
      name: "Casa",
      identity: "casa",
      terms: [
        { op: "", label: "Entró", amount: casa.entro },
        { op: "−", label: "Fijos", amount: casa.fijos },
        { op: "−", label: "Variables", amount: casa.variables },
        { op: "=", label: "Hoy", amount: casa.hoy, result: true },
        { op: "−", label: "Fijos sin pagar", amount: casa.fijosSinPagar },
        { op: "=", label: "Al cierre", amount: casa.alCierre, result: true },
      ],
      notices: notasCasa.length ? notasCasa : undefined,
    },
  ];
}

// ---------------------------------------------------------------------------
// Dónde está la plata
// ---------------------------------------------------------------------------

const TINTAS_NEGOCIO: AccountSwatch[] = ["ink", "ink-soft", "ink-faint"];
const TINTAS_CASA: AccountSwatch[] = ["casa", "casa-soft"];

/** Count status of an account, as the canvas writes it. */
export function estadoDeConteo(cuenta: CuentaMes, evaluado: MesEvaluado, datos: CasaNegocioMes): AccountBalance["status"] {
  const elemento = `cuenta:${cuenta.id}`;
  const sinContar = evaluado.avisos.find((a) => a.reglaId === "CUENTA_SIN_CONTAR" && a.elemento === elemento);
  const detalle = cuenta.ultimoArqueo
    ? datos.arqueos.flatMap((a) => a.detalles).find((d) => d.cuentaId === cuenta.id)
    : undefined;
  const diferencia = entero(detalle?.diferencia ?? 0);

  if (diferencia !== 0) {
    const texto = diferencia < 0 ? `Faltan ${formatMoney(-diferencia)}` : `Sobran ${formatMoney(diferencia)}`;
    // The figure is a fact; the red is rule 5's, so it follows its switch.
    return { text: texto, tone: reglaActiva(evaluado.config, "ARQUEO_NO_CUADRA") ? "problema" : "neutral" };
  }
  if (sinContar) return { text: capitalizar(sinContar.texto.replace(`${cuenta.nombre} `, "")), tone: "neutral" };
  if (!cuenta.ultimoArqueo) return { text: "Sin contar", tone: "neutral" };
  return { text: "Cuadra", tone: "ok" };
}

function dondeEstaLaPlata(datos: CasaNegocioMes, evaluado: MesEvaluado): TableroData["money"] {
  const activas = datos.cuentas.filter((c) => !c.archivada);
  const porId = new Map(activas.map((c) => [c.id, c]));
  const familia = calcularDineroFamilia(
    activas.map((c) => ({ cuentaId: c.id, nombre: c.nombre, ambito: c.grupo, tipo: c.tipo, saldo: entero(c.saldoFinMes) })),
    { capitalPendiente: entero(datos.cartera.enLaCalle), creditosActivos: datos.cartera.creditosActivos },
  );
  let negocio = 0;
  let casa = 0;
  const accounts = familia.cuentas.map((c): AccountBalance => {
    const swatch: AccountSwatch =
      c.tipo === "AHORRO"
        ? "ahorro"
        : c.ambito === "NEGOCIO"
          ? TINTAS_NEGOCIO[negocio++ % TINTAS_NEGOCIO.length]
          : TINTAS_CASA[casa++ % TINTAS_CASA.length];
    return { id: c.cuentaId, name: c.nombre, balance: c.saldo, swatch, status: estadoDeConteo(porId.get(c.cuentaId)!, evaluado, datos) };
  });
  return { total: familia.total, accounts };
}

// ---------------------------------------------------------------------------
// Phone: the first thing to do
// ---------------------------------------------------------------------------

function siguienteAccion(evaluado: MesEvaluado, c: Contexto): NextActionData | undefined {
  if (!c.esMesActual) return undefined;
  const pasos: Omit<NextActionData, "more">[] = [];
  for (const f of evaluado.calculo.fijos) {
    if (f.estado !== "SIN_PAGAR" || !f.vence) continue;
    if (!evaluado.avisos.some((a) => a.elemento === `fijo:${f.id}` && a.reglaId === "FIJO_VENCIDO")) continue;
    pasos.push({
      title: `Pagar ${f.nombre}`,
      detail: `${formatMoney(f.pendiente)} · venció el ${Number(f.vence.slice(8, 10))}`,
      href: hrefPagarFijo(TAB, c.mes, c.mesHoy, f.id, f.pendiente),
    });
  }
  for (const a of evaluado.avisos) {
    if (a.reglaId === "ARQUEO_NO_CUADRA") pasos.push({ title: "Revisar el arqueo", detail: a.texto, href: hrefArqueo(c) });
  }
  for (const a of evaluado.avisos) {
    if (a.reglaId === "CUENTA_SIN_CONTAR") pasos.push({ title: "Contar", detail: a.texto, href: hrefArqueo(c) });
  }
  for (const a of evaluado.avisos) {
    if (a.reglaId === "CIERRE_SIN_AHORRO") pasos.push({ title: "Pasar al ahorro", detail: a.texto, href: hrefAhorro(c) });
  }
  return pasos.length ? { ...pasos[0], more: pasos.length - 1 } : undefined;
}

// ---------------------------------------------------------------------------
// The whole tab
// ---------------------------------------------------------------------------

export type VistaTablero =
  /** No accounts yet: nothing to show until Configuración creates them. */
  | { estado: "sin-cuentas"; puedeConfigurar: boolean; hrefConfiguracion: string }
  | { estado: "listo"; data: TableroData };

export function construirTablero(datos: CasaNegocioMes, evaluado: MesEvaluado): VistaTablero {
  const c = contextoDe(datos);
  if (!datos.cuentas.some((cuenta) => !cuenta.archivada)) {
    return {
      estado: "sin-cuentas",
      puedeConfigurar: datos.usuario.capacidades.includes("CONFIGURAR"),
      hrefConfiguracion: hrefPestana("configuracion", c.mes, c.mesHoy),
    };
  }

  const atrasados = evaluado.avisos.find((a) => a.reglaId === "CREDITO_SIN_PAGOS");
  const umbralSobre = evaluado.config.SOBRE_CERCA_TOPE?.umbral ?? 90;

  return {
    estado: "listo",
    data: {
      quietMonth: mesSinMovimientos(datos) ? `Sin movimientos en ${nombreMes(datos.mes)}.` : undefined,
      next: siguienteAccion(evaluado, c),
      moneyPath: caminoDeLaPlata(evaluado),
      calendar: calendario(datos, evaluado, c),
      equations: ecuaciones(evaluado, c),
      money: dondeEstaLaPlata(datos, evaluado),
      street: {
        amount: entero(datos.cartera.enLaCalle),
        activeCredits: datos.cartera.creditosActivos,
        stale: atrasados ? { text: atrasados.texto, href: HREF_CUOTAS } : undefined,
      },
      envelopes: evaluado.calculo.sobres.sobres.map((s) => ({ id: s.id, name: s.nombre, spent: s.gastado, cap: s.tope })),
      // Rule 2 switched off: envelopes never turn amber (past the cap is still red: a fact).
      envelopeNearShare: reglaActiva(evaluado.config, "SOBRE_CERCA_TOPE") ? umbralSobre / 100 : Number.POSITIVE_INFINITY,
    },
  };
}
