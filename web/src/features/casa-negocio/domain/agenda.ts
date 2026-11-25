import { compararDias, diaDelMes, mesDe, nombreMes, ultimoDia } from "./dates";
import type { FijoDelMes } from "./fijos-sobres";
import type { CobroHechoInput, CuotaProgramadaInput, DiaISO, MesISO, Pesos, RetiroInput } from "./inputs";
import { assertPesos, sumarPesos } from "./money";
import { millones, pesos, plural } from "./texto";

/**
 * "Agenda del mes": the events that feed both the month line (ModuloTabs.dc.html) and the
 * compact calendar (Main.dc.html). One list, two renderings: the line places each event at
 * its day; the calendar groups them with `porDia`.
 *
 * Event kinds and how they are built:
 * - COBRO_HECHO     cash received from credits, grouped by the day it came in.
 * - COBRO_ESPERADO  unpaid cuotas grouped by scheduled day. Today or later → POR_VENIR;
 *                   already past → SIN_PAGAR (still owed by clients).
 * - PAGO_CASA       a fijo paid (on its payment day, HECHO) or still upcoming (on its due day).
 * - SIN_PAGAR       a fijo whose due day passed unpaid (red ring on the line).
 * - RETIRO          a retiro a la casa (filled square on the line).
 * - CIERRE          the month's last day: propose moving the leftover to savings.
 *
 * Nothing is phrased as a countdown (spec §4): texts state facts, not "faltan N días".
 */

export type TipoEvento = "COBRO_HECHO" | "COBRO_ESPERADO" | "PAGO_CASA" | "SIN_PAGAR" | "RETIRO" | "CIERRE";
export type EstadoEvento = "HECHO" | "POR_VENIR" | "SIN_PAGAR";
export type AccionSugerida = "PAGAR" | "VER_CUOTAS" | "IR_A_AHORRO";

export interface EventoAgenda {
  /** Stable key for React lists and popovers. */
  id: string;
  dia: DiaISO;
  diaDelMes: number;
  tipo: TipoEvento;
  estado: EstadoEvento;
  /** Short marker label: "6 cobros", "Retiro +3,0 M", "Funeraria", "Cierre". */
  texto: string;
  /** Popover title: "Retiro a la casa", "5 cuotas por cobrar hoy". */
  titulo: string;
  /** Popover detail: "$ 32.000 · sin pagar desde el 16". */
  detalle: string;
  monto: Pesos;
  accion: AccionSugerida | null;
  /** Ids behind the event (fijo id, credit ids, retiro id) for the action handler. */
  refs: string[];
}

export interface AgendaInput {
  mes: MesISO;
  hoy: DiaISO;
  cobrosHechos: readonly CobroHechoInput[];
  cuotas: readonly CuotaProgramadaInput[];
  fijos: readonly FijoDelMes[];
  retiros: readonly RetiroInput[];
  /** Casa "al cierre" (what would go to savings today). */
  alCierre: Pesos;
}

export interface AgendaMes {
  eventos: EventoAgenda[];
  /** Day of month (1–31) → events, for the calendar grid. Days without events are absent. */
  porDia: Record<number, EventoAgenda[]>;
}

// Within a day: cash in first, then house payments, then what is pending, cierre last. Matches
// the canvas popovers (cobros before casa before falta before ahorro).
const ORDEN: Record<TipoEvento, number> = { COBRO_HECHO: 0, RETIRO: 1, PAGO_CASA: 2, SIN_PAGAR: 3, COBRO_ESPERADO: 4, CIERRE: 5 };

function agrupar<T>(items: readonly T[], clave: (t: T) => DiaISO): Map<DiaISO, T[]> {
  const m = new Map<DiaISO, T[]>();
  for (const it of items) {
    const k = clave(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function construirAgenda(input: AgendaInput): AgendaMes {
  const { mes, hoy } = input;
  const enMes = (d: DiaISO) => mesDe(d) === mes;
  const eventos: EventoAgenda[] = [];
  const push = (e: Omit<EventoAgenda, "diaDelMes">) => eventos.push({ ...e, diaDelMes: diaDelMes(e.dia) });

  // Cobros hechos: one event per day of cash received.
  for (const [dia, cobros] of agrupar(input.cobrosHechos.filter((c) => enMes(c.fecha)), (c) => c.fecha)) {
    const monto = sumarPesos(cobros.map((c) => c.monto), "cobro");
    push({
      id: `cobro-hecho:${dia}`, dia, tipo: "COBRO_HECHO", estado: "HECHO",
      texto: plural(cobros.length, "cobro"), titulo: `${plural(cobros.length, "cuota cobrada", "cuotas cobradas")}`,
      detalle: `${plural(cobros.length, "cuota cobrada", "cuotas cobradas")} · ${pesos(monto)}`,
      monto, accion: null, refs: [...new Set(cobros.map((c) => c.creditoId))],
    });
  }

  // Cuotas still owed, by scheduled day. Fully paid cuotas (pendiente 0) are already in cobros.
  const abiertas = input.cuotas.filter((c) => enMes(c.fechaProgramada) && assertPesos(c.pendiente, "pendiente") > 0);
  for (const [dia, cuotas] of agrupar(abiertas, (c) => c.fechaProgramada)) {
    const monto = sumarPesos(cuotas.map((c) => c.pendiente));
    const vencida = compararDias(dia, hoy) < 0;
    const esHoy = dia === hoy;
    const n = cuotas.length;
    const titulo = vencida
      ? `${plural(n, "cuota")} sin pagar`
      : `${plural(n, "cuota")} por cobrar${esHoy ? " hoy" : ""}`;
    push({
      id: `cobro-esperado:${dia}`, dia, tipo: "COBRO_ESPERADO", estado: vencida ? "SIN_PAGAR" : "POR_VENIR",
      texto: plural(n, "cobro"), titulo,
      detalle: vencida ? `${pesos(monto)} · sin pagar desde el ${diaDelMes(dia)}` : `${pesos(monto)} entre ${plural(new Set(cuotas.map((c) => c.creditoId)).size, "cliente")}`,
      monto, accion: "VER_CUOTAS", refs: [...new Set(cuotas.map((c) => c.creditoId))],
    });
  }

  // Fijos: paid ones sit on their payment day; owed ones on their due day.
  for (const f of input.fijos) {
    if (f.estado === "NO_TOCA" || f.vence === null) continue;
    if (f.estado === "PAGADO") {
      const dia = f.pagadoEl && enMes(f.pagadoEl) ? f.pagadoEl : f.vence;
      push({
        id: `fijo:${f.id}`, dia, tipo: "PAGO_CASA", estado: "HECHO", texto: f.nombre, titulo: f.nombre,
        detalle: `${pesos(f.pagado)} · pagado el ${diaDelMes(dia)}`, monto: f.pagado, accion: null, refs: [f.id],
      });
    } else if (f.pendiente > 0) {
      const sinPagar = f.estado === "SIN_PAGAR";
      push({
        id: `fijo:${f.id}`, dia: f.vence, tipo: sinPagar ? "SIN_PAGAR" : "PAGO_CASA", estado: sinPagar ? "SIN_PAGAR" : "POR_VENIR",
        texto: f.nombre, titulo: f.nombre,
        detalle: `${pesos(f.pendiente)} · ${sinPagar ? "sin pagar desde" : "vence"} el ${diaDelMes(f.vence)}`,
        monto: f.pendiente, accion: "PAGAR", refs: [f.id],
      });
    }
  }

  for (const r of input.retiros.filter((x) => enMes(x.fecha))) {
    const monto = assertPesos(r.monto, "retiro");
    push({
      id: `retiro:${r.id}`, dia: r.fecha, tipo: "RETIRO", estado: "HECHO", texto: `Retiro +${millones(monto)}`,
      titulo: "Retiro a la casa", detalle: `${pesos(monto)} · ${r.cuentaOrigen} → ${r.cuentaDestino}`, monto, accion: null, refs: [r.id],
    });
  }

  // Cierre: always present so the line ends somewhere. Before/at the last day it proposes the
  // move with today's figure; once passed it is a done marker (warning 10 covers a missed move).
  const fin = ultimoDia(mes);
  const cerrado = compararDias(hoy, fin) > 0;
  const sobra = Math.max(0, input.alCierre);
  push({
    id: `cierre:${mes}`, dia: fin, tipo: "CIERRE", estado: cerrado ? "HECHO" : "POR_VENIR", texto: "Cierre",
    titulo: `Cierre de ${nombreMes(mes)}`,
    detalle: sobra > 0
      ? `Pasar lo que sobre al ahorro · ${cerrado ? "sobraron" : "hoy serían"} ${pesos(sobra)}`
      : `No ${cerrado ? "sobró" : "sobra"} para el ahorro`,
    monto: sobra, accion: sobra > 0 ? "IR_A_AHORRO" : null, refs: [],
  });

  eventos.sort((a, b) => compararDias(a.dia, b.dia) || ORDEN[a.tipo] - ORDEN[b.tipo] || a.id.localeCompare(b.id));
  const porDia: Record<number, EventoAgenda[]> = {};
  for (const e of eventos) (porDia[e.diaDelMes] ??= []).push(e);
  return { eventos, porDia };
}
