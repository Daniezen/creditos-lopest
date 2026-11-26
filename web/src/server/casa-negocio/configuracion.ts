/**
 * Configuración services: accounts, household expense categories, goals,
 * alert rules and who-can-what. Capability: configurar, for all of them.
 *
 * Same discipline as `movimientos.ts`: capability first, zod parse, one
 * transaction, audit row inside it, optimistic lock on every edit.
 */
import type { CnCapacidad, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { assertVersionClaimed, updatedAtMatches } from "@/server/optimistic-lock";
import { parseInput } from "@/server/validation/input";
import {
  archivarCuentaSchema,
  crearCategoriaSchema,
  crearCuentaSchema,
  definirCapacidadesSchema,
  editarCategoriaSchema,
  editarConfiguracionSchema,
  editarCuentaSchema,
  editarReglaAvisoSchema,
  eliminarCuentaSchema,
} from "@/features/casa-negocio/schemas";

import { CODIGO_CAPACIDAD, requireCapacidad } from "./capacidades";
import { aDecimal } from "./dinero";
import { CasaNegocioReglaError } from "./errors";
import { cargarAsientos, saldosActuales } from "./saldos";
import { ENTIDAD, accion, esViolacionUnica, imagen } from "./shared";

function nombreRepetido(error: unknown, que: string): never {
  if (esViolacionUnica(error)) throw new CasaNegocioReglaError(`Ya existe ${que} con ese nombre.`, "nombre");
  throw error;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function crearCuenta(raw: unknown): Promise<{ cuentaId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const input = parseInput(crearCuentaSchema, raw);
  if (input.tipo === "AHORRO" && input.grupo !== "CASA") {
    throw new CasaNegocioReglaError("La cuenta de ahorro pertenece a la casa.", "tipo");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const creada = await tx.cnCuenta.create({
        data: { ...input, saldoInicial: aDecimal(input.saldoInicial), accionPor: actor.id },
      });
      await recordAuditLogTx(tx, {
        actorId: actor.id,
        action: accion("cuenta.crear"),
        entityType: ENTIDAD.cuenta,
        entityId: creada.id,
        after: imagen(creada),
      });
      return { cuentaId: creada.id };
    });
  } catch (error) {
    return nombreRepetido(error, "una cuenta");
  }
}

/**
 * Edits name, type, order and the opening balance/date. The group is fixed
 * once created: moving an account between NEGOCIO and CASA would silently
 * re-file every movement it ever had (a retiro would become a traslado).
 */
export async function editarCuenta(raw: unknown): Promise<{ cuentaId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { cuentaId, version, ...datos } = parseInput(editarCuentaSchema, raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const antes = await tx.cnCuenta.findUnique({ where: { id: cuentaId } });
      if (!antes) throw new CasaNegocioReglaError("La cuenta no existe.");
      if (datos.tipo === "AHORRO" && antes.grupo !== "CASA") {
        throw new CasaNegocioReglaError("La cuenta de ahorro pertenece a la casa.", "tipo");
      }
      if (antes.tipo === "AHORRO" && datos.tipo !== "AHORRO") {
        const config = await tx.cnConfiguracion.findUnique({ where: { id: "default" }, select: { cuentaAhorroId: true } });
        if (config?.cuentaAhorroId === cuentaId) {
          throw new CasaNegocioReglaError("Es la cuenta de ahorro elegida; cambia primero la meta de ahorro.", "tipo");
        }
      }
      const claimed = await tx.cnCuenta.updateMany({
        where: { id: cuentaId, actualizadoEn: updatedAtMatches(version) },
        data: { ...datos, saldoInicial: aDecimal(datos.saldoInicial), accionPor: actor.id },
      });
      assertVersionClaimed(claimed.count);
      const despues = await tx.cnCuenta.findUniqueOrThrow({ where: { id: cuentaId } });
      await recordAuditLogTx(tx, {
        actorId: actor.id,
        action: accion("cuenta.editar"),
        entityType: ENTIDAD.cuenta,
        entityId: cuentaId,
        before: imagen(antes),
        after: imagen(despues),
      });
      return { cuentaId };
    });
  } catch (error) {
    return nombreRepetido(error, "una cuenta");
  }
}

/**
 * Archives or restores an account. Accounts are never deleted (spec §3). An
 * account can only be archived with a zero balance, otherwise its money would
 * vanish from "dónde está la plata"; nor while it is the savings account.
 */
export async function archivarCuenta(raw: unknown): Promise<{ cuentaId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { cuentaId, version, archivada } = parseInput(archivarCuentaSchema, raw);
  return prisma.$transaction(async (tx) => {
    const antes = await tx.cnCuenta.findUnique({ where: { id: cuentaId } });
    if (!antes) throw new CasaNegocioReglaError("La cuenta no existe.");
    if (antes.archivada === archivada) return { cuentaId };

    if (archivada) {
      const saldo = saldosActuales([antes], await cargarAsientos(tx, [cuentaId])).get(cuentaId) ?? 0;
      if (saldo !== 0) {
        throw new CasaNegocioReglaError("La cuenta todavía tiene saldo; trasládalo antes de archivarla.");
      }
      const config = await tx.cnConfiguracion.findUnique({ where: { id: "default" }, select: { cuentaAhorroId: true } });
      if (config?.cuentaAhorroId === cuentaId) {
        throw new CasaNegocioReglaError("Es la cuenta de ahorro elegida; cambia primero la meta de ahorro.");
      }
    }
    const claimed = await tx.cnCuenta.updateMany({
      where: { id: cuentaId, actualizadoEn: updatedAtMatches(version) },
      data: { archivada, archivadaEn: archivada ? new Date() : null, accionPor: actor.id },
    });
    assertVersionClaimed(claimed.count);
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion(archivada ? "cuenta.archivar" : "cuenta.restaurar"),
      entityType: ENTIDAD.cuenta,
      entityId: cuentaId,
      before: imagen({ archivada: antes.archivada, archivadaEn: antes.archivadaEn }),
      after: imagen({ archivada }),
    });
    return { cuentaId };
  });
}

// ---------------------------------------------------------------------------
// Household expense categories
// ---------------------------------------------------------------------------

export async function crearCategoria(raw: unknown): Promise<{ categoriaId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const input = parseInput(crearCategoriaSchema, raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const creada = await tx.cnCategoriaGasto.create({
        data: { ...input, monto: input.monto === null ? null : aDecimal(input.monto), accionPor: actor.id },
      });
      await recordAuditLogTx(tx, {
        actorId: actor.id,
        action: accion("categoria.crear"),
        entityType: ENTIDAD.categoria,
        entityId: creada.id,
        after: imagen(creada),
      });
      return { categoriaId: creada.id };
    });
  } catch (error) {
    return nombreRepetido(error, "un gasto");
  }
}

/**
 * Edits a category. When its class flips (fijo <-> variable, spec §3: "se
 * cambia desde Configuración sin perder movimientos") the category's live
 * movements are re-filed under the new kind in the same transaction, so
 * every month recalculates with the category where it now lives. The count
 * of re-filed movements goes into the audit metadata.
 */
export async function editarCategoria(raw: unknown): Promise<{ categoriaId: string; movimientosReclasificados: number }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { categoriaId, version, ...datos } = parseInput(editarCategoriaSchema, raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const antes = await tx.cnCategoriaGasto.findUnique({ where: { id: categoriaId } });
      if (!antes) throw new CasaNegocioReglaError("El gasto no existe.");
      const claimed = await tx.cnCategoriaGasto.updateMany({
        where: { id: categoriaId, actualizadoEn: updatedAtMatches(version) },
        data: { ...datos, monto: datos.monto === null ? null : aDecimal(datos.monto), accionPor: actor.id },
      });
      assertVersionClaimed(claimed.count);

      let movimientosReclasificados = 0;
      if (antes.clase !== datos.clase) {
        const reclasificados = await tx.cnMovimiento.updateMany({
          where: { categoriaId, eliminadoEn: null },
          data: { tipo: datos.clase === "FIJO" ? "GASTO_FIJO" : "GASTO_VARIABLE", accionPor: actor.id },
        });
        movimientosReclasificados = reclasificados.count;
      }

      const despues = await tx.cnCategoriaGasto.findUniqueOrThrow({ where: { id: categoriaId } });
      await recordAuditLogTx(tx, {
        actorId: actor.id,
        action: accion("categoria.editar"),
        entityType: ENTIDAD.categoria,
        entityId: categoriaId,
        before: imagen(antes),
        after: imagen(despues),
        metadata: movimientosReclasificados ? { movimientosReclasificados } : null,
      });
      return { categoriaId, movimientosReclasificados };
    });
  } catch (error) {
    return nombreRepetido(error, "un gasto");
  }
}

// ---------------------------------------------------------------------------
// Goals and savings account
// ---------------------------------------------------------------------------

export async function editarConfiguracion(raw: unknown): Promise<void> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { version, ...datos } = parseInput(editarConfiguracionSchema, raw);
  await prisma.$transaction(async (tx) => {
    if (datos.cuentaAhorroId) {
      const cuenta = await tx.cnCuenta.findUnique({
        where: { id: datos.cuentaAhorroId },
        select: { grupo: true, tipo: true, archivada: true },
      });
      if (!cuenta || cuenta.archivada || cuenta.grupo !== "CASA" || cuenta.tipo !== "AHORRO") {
        throw new CasaNegocioReglaError("La cuenta de ahorro debe ser una cuenta de ahorro de la casa, activa.", "cuentaAhorroId");
      }
    }
    const antes = await tx.cnConfiguracion.findUniqueOrThrow({ where: { id: "default" } });
    const claimed = await tx.cnConfiguracion.updateMany({
      where: { id: "default", actualizadoEn: updatedAtMatches(version) },
      data: {
        metaAsignacionCasa: datos.metaAsignacionCasa === null ? null : aDecimal(datos.metaAsignacionCasa),
        metaAhorro: datos.metaAhorro === null ? null : aDecimal(datos.metaAhorro),
        cuentaAhorroId: datos.cuentaAhorroId,
        accionPor: actor.id,
      },
    });
    assertVersionClaimed(claimed.count);
    const despues = await tx.cnConfiguracion.findUniqueOrThrow({ where: { id: "default" } });
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("configuracion.editar"),
      entityType: ENTIDAD.configuracion,
      entityId: "default",
      before: imagen(antes),
      after: imagen(despues),
    });
  });
}

export async function editarReglaAviso(raw: unknown): Promise<void> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { codigo, version, activa, umbral } = parseInput(editarReglaAvisoSchema, raw);
  await prisma.$transaction(async (tx) => {
    const antes = await tx.cnReglaAviso.findUnique({ where: { codigo } });
    if (!antes) throw new CasaNegocioReglaError("El aviso no existe.");
    const claimed = await tx.cnReglaAviso.updateMany({
      where: { codigo, actualizadoEn: updatedAtMatches(version) },
      data: { activa, umbral, accionPor: actor.id },
    });
    assertVersionClaimed(claimed.count);
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("aviso.editar"),
      entityType: ENTIDAD.regla,
      entityId: codigo,
      before: imagen({ activa: antes.activa, umbral: antes.umbral }),
      after: imagen({ activa, umbral }),
    });
  });
}

// ---------------------------------------------------------------------------
// Who can what
// ---------------------------------------------------------------------------

/**
 * Replaces a person's capabilities with the given set. Two guards keep the
 * module administrable: the module can never be left without someone who can
 * configure it, and any capability implies VER (a person who can write but
 * not see would be stuck). Concurrency: the configurators are counted after
 * taking a transaction-scoped advisory lock, so two people removing each
 * other's CONFIGURAR at once cannot both succeed.
 */
export async function definirCapacidades(raw: unknown): Promise<{ capacidades: CnCapacidad[] }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { userId, capacidades: pedidas } = parseInput(definirCapacidadesSchema, raw);
  const capacidades: CnCapacidad[] = pedidas.length > 0 && !pedidas.includes("VER") ? ["VER", ...pedidas] : pedidas;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('casa_negocio.permisos'))`;

    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, activo: true } });
    if (!user) throw new CasaNegocioReglaError("La persona no existe.", "userId");
    if (!user.activo && capacidades.length > 0) {
      throw new CasaNegocioReglaError("La persona está inactiva en Lopest.", "userId");
    }

    const antes = (await tx.cnPermiso.findMany({ where: { userId }, select: { capacidad: true } })).map((p) => p.capacidad);
    if (antes.includes("CONFIGURAR") && !capacidades.includes("CONFIGURAR")) {
      const otros = await tx.cnPermiso.count({ where: { capacidad: "CONFIGURAR", userId: { not: userId }, user: { activo: true } } });
      if (otros === 0) {
        throw new CasaNegocioReglaError("Alguien tiene que poder configurar el módulo; da ese permiso a otra persona primero.");
      }
    }

    const quitar = antes.filter((c) => !capacidades.includes(c));
    const agregar = capacidades.filter((c) => !antes.includes(c));
    if (quitar.length === 0 && agregar.length === 0) return { capacidades };

    if (quitar.length > 0) await tx.cnPermiso.deleteMany({ where: { userId, capacidad: { in: quitar } } });
    if (agregar.length > 0) {
      await tx.cnPermiso.createMany({ data: agregar.map((capacidad) => ({ userId, capacidad, accionPor: actor.id })) });
    }
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("permisos.definir"),
      entityType: ENTIDAD.permiso,
      entityId: userId,
      before: { capacidades: antes.map((c) => CODIGO_CAPACIDAD[c]) },
      after: { capacidades: capacidades.map((c) => CODIGO_CAPACIDAD[c]) },
    });
    return { capacidades };
  });
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * Number of rows that reference an account: manual movements on either side,
 * automatic movements assigned to it and arqueo lines that counted it. Any of
 * them makes the account part of the history, so it can only be archived.
 */
export async function usosDeCuenta(
  db: Pick<Prisma.TransactionClient, "cnMovimiento" | "cnAsignacionCuenta" | "cnArqueoDetalle">,
  cuentaId: string,
): Promise<number> {
  const [movimientos, asignaciones, conteos] = await Promise.all([
    // Soft-deleted movements count too: they still point at the account.
    db.cnMovimiento.count({ where: { OR: [{ cuentaOrigenId: cuentaId }, { cuentaDestinoId: cuentaId }] } }),
    db.cnAsignacionCuenta.count({ where: { cuentaId } }),
    db.cnArqueoDetalle.count({ where: { cuentaId } }),
  ]);
  return movimientos + asignaciones + conteos;
}

/**
 * Deletes an account created by mistake. Spec §3: an account with movements
 * is never deleted, it is archived; so this refuses as soon as anything
 * references it (including the savings choice), and the row lock taken by
 * the version claim keeps a concurrent movement from slipping in between the
 * check and the delete (the movement's FK check waits on that lock).
 */
export async function eliminarCuenta(raw: unknown): Promise<{ cuentaId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { cuentaId, version } = parseInput(eliminarCuentaSchema, raw);
  return prisma.$transaction(async (tx) => {
    const antes = await tx.cnCuenta.findUnique({ where: { id: cuentaId } });
    if (!antes) throw new CasaNegocioReglaError("La cuenta no existe.");
    const claimed = await tx.cnCuenta.updateMany({
      where: { id: cuentaId, actualizadoEn: updatedAtMatches(version) },
      data: { accionPor: actor.id },
    });
    assertVersionClaimed(claimed.count);

    if ((await usosDeCuenta(tx, cuentaId)) > 0) {
      throw new CasaNegocioReglaError("La cuenta ya tiene movimientos; no se borra, se archiva.");
    }
    const config = await tx.cnConfiguracion.findUnique({ where: { id: "default" }, select: { cuentaAhorroId: true } });
    if (config?.cuentaAhorroId === cuentaId) {
      throw new CasaNegocioReglaError("Es la cuenta de ahorro elegida; elige otra antes de borrarla.");
    }

    await tx.cnCuenta.delete({ where: { id: cuentaId } });
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("cuenta.eliminar"),
      entityType: ENTIDAD.cuenta,
      entityId: cuentaId,
      before: imagen(antes),
    });
    return { cuentaId };
  });
}
