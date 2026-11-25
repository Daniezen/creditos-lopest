/**
 * Manual movements: register, edit, void, and the "pasar al ahorro" shortcut.
 *
 * Every function follows the same order, which the tests pin:
 *   1. capability on the server (`requireCapacidad`), before reading input;
 *   2. zod parse (`parseInput`), so nothing unvalidated reaches a query;
 *   3. one interactive transaction that loads the referenced rows, applies the
 *      business rules, writes, and records the audit row with
 *      `recordAuditLogTx` (the audit commits or rolls back with the change);
 *   4. edits claim the row with the optimistic lock (`updatedAtMatches`) so a
 *      stale form never overwrites a newer version.
 *
 * Movements are never deleted: voiding sets `eliminadoEn` and keeps the row.
 */
import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { assertVersionClaimed, updatedAtMatches } from "@/server/optimistic-lock";
import { parseInput } from "@/server/validation/input";
import {
  anularMovimientoSchema,
  editarMovimientoSchema,
  pasarAlAhorroSchema,
  registrarMovimientoSchema,
} from "@/features/casa-negocio/schemas";

import { requireCapacidad } from "./capacidades";
import { aDecimal } from "./dinero";
import { CasaNegocioReglaError } from "./errors";
import { validarMovimiento, type TipoMovimiento } from "./rules";
import { cargarAsientos, saldosActuales } from "./saldos";
import { ENTIDAD, accion, categoriaParaRegla, cuentaParaRegla, esViolacionUnica, imagen } from "./shared";
import type { Prisma } from "@prisma/client";

export interface ResultadoMovimiento {
  movimientoId: string;
  /** True when the operation key had already been used: nothing new was written. */
  repetido: boolean;
  /**
   * Balance of the origin account after the movement, so the UI can raise
   * alert 7 ("dejaría una cuenta sin saldo") without another round trip.
   * Null for movements without origin.
   */
  saldoOrigenDespues: number | null;
}

interface DatosMovimiento {
  tipo: TipoMovimiento;
  fecha: Date;
  monto: number;
  cuentaOrigenId: string | null;
  cuentaDestinoId: string | null;
  categoriaId: string | null;
  nota: string | null;
}

/** Loads the referenced rows, applies the rules and returns the data to store. */
async function prepararMovimiento(tx: Prisma.TransactionClient, datos: DatosMovimiento) {
  const [origen, destino, categoria] = await Promise.all([
    cuentaParaRegla(tx, datos.cuentaOrigenId, "cuentaOrigenId"),
    cuentaParaRegla(tx, datos.cuentaDestinoId, "cuentaDestinoId"),
    categoriaParaRegla(tx, datos.categoriaId),
  ]);
  const tipo = validarMovimiento({ tipo: datos.tipo, fecha: datos.fecha, origen, destino, categoria });
  return {
    tipo,
    fecha: datos.fecha,
    monto: aDecimal(datos.monto),
    cuentaOrigenId: datos.cuentaOrigenId,
    cuentaDestinoId: datos.cuentaDestinoId,
    categoriaId: datos.categoriaId,
    nota: datos.nota,
  };
}

async function saldoDe(tx: Prisma.TransactionClient, cuentaId: string | null): Promise<number | null> {
  if (!cuentaId) return null;
  const cuenta = await tx.cnCuenta.findUniqueOrThrow({
    where: { id: cuentaId },
    select: { id: true, saldoInicial: true, fechaSaldoInicial: true },
  });
  const asientos = await cargarAsientos(tx, [cuentaId]);
  return saldosActuales([cuenta], asientos).get(cuentaId) ?? 0;
}

/** Shared by `registrarMovimiento` and `pasarAlAhorro` (already parsed and authorized). */
async function crearMovimiento(
  actorId: string,
  operationKey: string,
  datos: DatosMovimiento,
): Promise<ResultadoMovimiento> {
  const existente = await prisma.cnMovimiento.findUnique({
    where: { idempotencyKey: operationKey },
    select: { id: true, cuentaOrigenId: true },
  });
  if (existente) return { movimientoId: existente.id, repetido: true, saldoOrigenDespues: null };

  try {
    return await prisma.$transaction(async (tx) => {
      const data = await prepararMovimiento(tx, datos);
      const creado = await tx.cnMovimiento.create({
        data: { ...data, idempotencyKey: operationKey, accionPor: actorId },
      });
      await recordAuditLogTx(tx, {
        actorId,
        action: accion("movimiento.registrar"),
        entityType: ENTIDAD.movimiento,
        entityId: creado.id,
        after: imagen(creado),
      });
      return { movimientoId: creado.id, repetido: false, saldoOrigenDespues: await saldoDe(tx, creado.cuentaOrigenId) };
    });
  } catch (error) {
    // Double click: the twin request committed first with the same key.
    if (esViolacionUnica(error)) {
      const twin = await prisma.cnMovimiento.findUnique({ where: { idempotencyKey: operationKey }, select: { id: true } });
      if (twin) return { movimientoId: twin.id, repetido: true, saldoOrigenDespues: null };
    }
    throw error;
  }
}

/** Registers any of the seven manual movement kinds. Capability: anotar. */
export async function registrarMovimiento(raw: unknown): Promise<ResultadoMovimiento> {
  const actor = await requireCapacidad("ANOTAR");
  const { operationKey, ...datos } = parseInput(registrarMovimientoSchema, raw);
  return crearMovimiento(actor.id, operationKey, datos);
}

/**
 * "Pasar al ahorro": a TRASLADO from a household account into the savings
 * account chosen in Configuración. Capability: anotar.
 */
export async function pasarAlAhorro(raw: unknown): Promise<ResultadoMovimiento> {
  const actor = await requireCapacidad("ANOTAR");
  const input = parseInput(pasarAlAhorroSchema, raw);
  const config = await prisma.cnConfiguracion.findUnique({ where: { id: "default" }, select: { cuentaAhorroId: true } });
  if (!config?.cuentaAhorroId) {
    throw new CasaNegocioReglaError("Elige primero la cuenta de ahorro en Configuración.", "cuentaOrigenId");
  }
  return crearMovimiento(actor.id, input.operationKey, {
    tipo: "TRASLADO",
    fecha: input.fecha,
    monto: input.monto,
    cuentaOrigenId: input.cuentaOrigenId,
    cuentaDestinoId: config.cuentaAhorroId,
    categoriaId: null,
    nota: input.nota,
  });
}

/** Edits a movement (any field) under the optimistic lock. Capability: anotar. */
export async function editarMovimiento(raw: unknown): Promise<ResultadoMovimiento> {
  const actor = await requireCapacidad("ANOTAR");
  const { movimientoId, version, ...datos } = parseInput(editarMovimientoSchema, raw);

  return prisma.$transaction(async (tx) => {
    const antes = await tx.cnMovimiento.findUnique({ where: { id: movimientoId } });
    if (!antes) throw new CasaNegocioReglaError("El movimiento no existe.");
    if (antes.eliminadoEn) throw new CasaNegocioReglaError("El movimiento está anulado; no se puede editar.");

    const data = await prepararMovimiento(tx, datos);
    const claimed = await tx.cnMovimiento.updateMany({
      where: { id: movimientoId, eliminadoEn: null, actualizadoEn: updatedAtMatches(version) },
      data: { ...data, accionPor: actor.id },
    });
    assertVersionClaimed(claimed.count);

    const despues = await tx.cnMovimiento.findUniqueOrThrow({ where: { id: movimientoId } });
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("movimiento.editar"),
      entityType: ENTIDAD.movimiento,
      entityId: movimientoId,
      before: imagen(antes),
      after: imagen(despues),
    });
    return { movimientoId, repetido: false, saldoOrigenDespues: await saldoDe(tx, despues.cuentaOrigenId) };
  });
}

/** Voids (soft-deletes) a movement with a reason. Capability: anotar. */
export async function anularMovimiento(raw: unknown): Promise<{ movimientoId: string }> {
  const actor = await requireCapacidad("ANOTAR");
  const { movimientoId, version, motivo } = parseInput(anularMovimientoSchema, raw);

  return prisma.$transaction(async (tx) => {
    const antes = await tx.cnMovimiento.findUnique({ where: { id: movimientoId } });
    if (!antes) throw new CasaNegocioReglaError("El movimiento no existe.");
    if (antes.eliminadoEn) throw new CasaNegocioReglaError("El movimiento ya estaba anulado.");

    const claimed = await tx.cnMovimiento.updateMany({
      where: { id: movimientoId, eliminadoEn: null, actualizadoEn: updatedAtMatches(version) },
      data: { eliminadoEn: new Date(), eliminadoPor: actor.id, motivoEliminacion: motivo, accionPor: actor.id },
    });
    assertVersionClaimed(claimed.count);

    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("movimiento.anular"),
      entityType: ENTIDAD.movimiento,
      entityId: movimientoId,
      reason: motivo,
      before: imagen(antes),
    });
    return { movimientoId };
  });
}
