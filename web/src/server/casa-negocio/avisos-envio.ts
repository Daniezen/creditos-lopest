/**
 * Daily Telegram digest of Casa y Negocio avisos (spec §5), called by the
 * n8n flow through `/api/cron/casa-negocio-avisos`.
 *
 * WHAT IT DOES. Evaluates today's month with the same engine the tabs use
 * (`evaluarMes`, so the saved on/off and thresholds of Configuración apply)
 * and reports only the avisos that are NEW since the last run. "Arriendo sin
 * pagar" is sent the morning it appears, not every morning after.
 *
 * DEDUPE MODEL. Each aviso has an identity (`claveAviso`): rule + month +
 * element (`fijo:<id>`, `cuenta:<id>`, ...). The table `cn_avisos_enviados`
 * remembers which identities were active at the last run:
 *   * not remembered, or remembered as resolved  -> new: report it;
 *   * remembered as active                       -> already told: stay quiet,
 *     unless it is an aggregated aviso (rule 8 lists credits) that gained an
 *     id it did not have: a credit joining the list is news, one leaving is not;
 *   * remembered as active but no longer produced -> mark resolved, so if it
 *     comes back later it is reported again.
 * The month is part of the identity on purpose: a fixed expense unpaid in
 * December and again in January are two different facts, and a slow aviso
 * (an account not counted for weeks) is re-reported once a month as a
 * reminder.
 *
 * DELIVERY SEMANTICS. The call that reports an aviso also records it, so it
 * is at-most-once: if Telegram fails after this endpoint answered, that aviso
 * is not retried the next day (it still shows in the app, where it lives).
 * n8n's error workflow ("LOPEST - Alertas de errores a Telegram") surfaces
 * that failure. The record step takes a transaction-scoped advisory lock, so
 * two overlapping runs cannot both report the same aviso.
 *
 * The planning and the message are pure functions (`planificarEnvio`,
 * `mensajeTelegram`), tested without a database.
 */
import { createHash } from "node:crypto";

import type { CnCodigoAviso, Prisma, PrismaClient } from "@prisma/client";

import type { Aviso, ReglaAvisoId } from "@/features/casa-negocio/domain";
import { fechaClave } from "@/features/casa-negocio/mes";

import { cargarCasaNegocioMes, type LectorCasaNegocio } from "./queries";
import { REGLA_DE_CODIGO, evaluarMes, reglaActiva } from "./vista-mes";

type Db = PrismaClient | Prisma.TransactionClient;

/** Engine rule id → database alert code (inverse of `REGLA_DE_CODIGO`). */
const CODIGO_DE_REGLA = Object.fromEntries(
  Object.entries(REGLA_DE_CODIGO).map(([codigo, regla]) => [regla, codigo]),
) as Record<ReglaAvisoId, CnCodigoAviso>;

/**
 * The viewer the cron reads as. Avisos are family-wide, so the loan scope is
 * ADMIN's (every owner's credits, as rule 8 must see the whole portfolio).
 * Only `VER` is held: the read never needs more, and the object never reaches
 * a write path. The id matches no user, so no row is labelled "propio".
 */
const LECTOR_SISTEMA: LectorCasaNegocio = {
  id: "sistema:avisos-telegram",
  nombre: "Avisos automáticos",
  roles: ["ADMIN"],
  capacidades: new Set(["VER"]),
};

/** Postgres advisory lock key for the record step (any stable 32-bit int). */
const LOCK_AVISOS = 72_616_401;

/** An aviso ready to be recorded and sent. */
export interface AvisoParaEnviar {
  clave: string;
  codigo: CnCodigoAviso;
  numero: number;
  nivel: Aviso["nivel"];
  texto: string;
  mes: string;
  elemento: string;
  refs: string[];
}

/** What the table remembers of an identity. */
export interface AvisoRecordado {
  clave: string;
  refs: string[];
  resueltoEn: Date | null;
}

/**
 * Identity of an aviso. Rule 5 (an arqueo that does not square) adds the
 * difference: a later count that is off by another amount is a new fact.
 * Long identities are hashed so the primary key stays short.
 */
export function claveAviso(aviso: Aviso, mes: string): string {
  const extra = aviso.reglaId === "ARQUEO_NO_CUADRA" ? `|${aviso.montos.diferencia ?? 0}` : "";
  const natural = `${CODIGO_DE_REGLA[aviso.reglaId]}|${mes}|${aviso.elemento}${extra}`;
  return natural.length <= 120 ? natural : `h:${createHash("sha256").update(natural).digest("hex")}`;
}

/**
 * Avisos worth a message. Rule 7 ("a movement would leave an account without
 * balance") only exists inside the Anotar panel, before saving: it is never
 * a standing fact, so it is never sent. Inactive rules are dropped again here
 * even though `evaluarMes` already skips them: the switch in Configuración is
 * the user's promise and must hold even if the engine changes.
 */
export function avisosEnviables(evaluados: readonly Aviso[], mes: string, activa: (regla: ReglaAvisoId) => boolean): AvisoParaEnviar[] {
  return evaluados
    .filter((a) => a.reglaId !== "CUENTA_SIN_SALDO" && activa(a.reglaId))
    .map((a) => ({
      clave: claveAviso(a, mes),
      codigo: CODIGO_DE_REGLA[a.reglaId],
      numero: a.numero,
      nivel: a.nivel,
      texto: a.texto,
      mes,
      elemento: a.elemento,
      refs: [...a.refs].sort(),
    }));
}

export interface PlanEnvio {
  /** Report and record as active (new, back after being resolved, or with new refs). */
  nuevos: AvisoParaEnviar[];
  /** Still active and already reported: only refresh `vistoEn`/`refs`. */
  vigentes: AvisoParaEnviar[];
  /** Active at the last run, gone now. */
  resueltos: string[];
}

/** Pure dedupe decision (see the module comment for the rules). */
export function planificarEnvio(actuales: readonly AvisoParaEnviar[], recordados: readonly AvisoRecordado[]): PlanEnvio {
  const porClave = new Map(recordados.map((r) => [r.clave, r]));
  const nuevos: AvisoParaEnviar[] = [];
  const vigentes: AvisoParaEnviar[] = [];
  const vistas = new Set<string>();

  for (const aviso of actuales) {
    // The engine never repeats an element within a rule, but a duplicate must
    // not become two messages nor two upserts of the same key.
    if (vistas.has(aviso.clave)) continue;
    vistas.add(aviso.clave);

    const previo = porClave.get(aviso.clave);
    const activo = previo !== undefined && previo.resueltoEn === null ? previo : null;
    const refsNuevas = activo !== null && aviso.refs.some((ref) => !activo.refs.includes(ref));
    if (activo === null || refsNuevas) nuevos.push(aviso);
    else vigentes.push(aviso);
  }

  const resueltos = recordados.filter((r) => r.resueltoEn === null && !vistas.has(r.clave)).map((r) => r.clave);
  return { nuevos, vigentes, resueltos };
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Plain-text Telegram message (no parse_mode: aviso texts carry `$`, `·` and
 * names that Markdown would mangle). Problems first, then attention, each in
 * spec order. Null when there is nothing new, so n8n sends nothing.
 */
export function mensajeTelegram(nuevos: readonly AvisoParaEnviar[], hoy: string, urlModulo: string | null): string | null {
  if (nuevos.length === 0) return null;
  const [, mes, dia] = hoy.split("-").map(Number);
  const orden = [...nuevos].sort(
    (a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "PROBLEMA" ? -1 : 1) || a.numero - b.numero,
  );
  const lineas = orden.map((a) => `${a.nivel === "PROBLEMA" ? "🔴" : "🟡"} ${a.texto}`);
  const titulo = `Casa y Negocio · ${dia} ${MESES_CORTOS[mes - 1]}`;
  return [titulo, "", ...lineas, ...(urlModulo ? ["", urlModulo] : [])].join("\n");
}

export type ResultadoEnvio =
  | { estado: "sin-modulo"; hoy: string; nuevos: []; mensaje: null }
  | { estado: "ok"; hoy: string; nuevos: AvisoParaEnviar[]; vigentes: number; resueltos: number; mensaje: string | null };

/**
 * Evaluates today's avisos and records the outcome. `db` must be the root
 * client (it opens its own transaction). `ahora` is injectable for tests.
 */
export async function avisosNuevosDelDia(
  db: PrismaClient,
  opciones: { ahora?: Date; urlModulo?: string | null } = {},
): Promise<ResultadoEnvio> {
  const ahora = opciones.ahora ?? new Date();
  const hoy = fechaClave(ahora);
  const mes = hoy.slice(0, 7);

  // Before the opening balances there is no module to watch: no accounts, or
  // a cron run on 30-nov for accounts that open on 1-dic, would only produce
  // noise ("cuenta sin contar", "fijo sin pagar" for a month not yet started).
  const datos = await cargarCasaNegocioMes(db, LECTOR_SISTEMA, mes, ahora);
  if (!datos.inicioModulo || datos.inicioModulo > hoy) {
    return { estado: "sin-modulo", hoy, nuevos: [], mensaje: null };
  }

  const { avisos, config } = evaluarMes(datos);
  const actuales = avisosEnviables(avisos, mes, (regla) => reglaActiva(config, regla));

  const plan = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_AVISOS})`;
    const recordados = await tx.cnAvisoEnviado.findMany({
      where: { OR: [{ resueltoEn: null }, { clave: { in: actuales.map((a) => a.clave) } }] },
      select: { clave: true, refs: true, resueltoEn: true },
    });
    const decision = planificarEnvio(actuales, recordados);
    await registrarPlan(tx, decision, ahora);
    return decision;
  });

  return {
    estado: "ok",
    hoy,
    nuevos: plan.nuevos,
    vigentes: plan.vigentes.length,
    resueltos: plan.resueltos.length,
    mensaje: mensajeTelegram(plan.nuevos, hoy, opciones.urlModulo ?? null),
  };
}

/** Writes the plan: upsert reported and still-active avisos, close the gone ones. */
async function registrarPlan(db: Db, plan: PlanEnvio, ahora: Date): Promise<void> {
  for (const aviso of plan.nuevos) {
    const datos = { codigo: aviso.codigo, mes: aviso.mes, elemento: aviso.elemento, refs: aviso.refs, texto: aviso.texto };
    await db.cnAvisoEnviado.upsert({
      where: { clave: aviso.clave },
      create: { clave: aviso.clave, ...datos, enviadoEn: ahora, vistoEn: ahora },
      update: { ...datos, enviadoEn: ahora, vistoEn: ahora, resueltoEn: null },
    });
  }
  if (plan.vigentes.length > 0) {
    // Refs are refreshed too: a credit that left rule 8's list and comes back
    // later must count as news again.
    for (const aviso of plan.vigentes) {
      await db.cnAvisoEnviado.update({ where: { clave: aviso.clave }, data: { vistoEn: ahora, refs: aviso.refs, texto: aviso.texto } });
    }
  }
  if (plan.resueltos.length > 0) {
    await db.cnAvisoEnviado.updateMany({ where: { clave: { in: plan.resueltos }, resueltoEn: null }, data: { resueltoEn: ahora } });
  }
}
