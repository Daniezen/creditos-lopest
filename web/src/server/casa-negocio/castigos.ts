/**
 * Loan write-offs ("préstamo perdido"). There is no UI for them in this unit
 * (Créditos is out of scope); the services exist so the model is usable and
 * the Tablero can subtract losses as soon as a screen calls them.
 *
 * Capability: configurar (a write-off changes the business result), plus the
 * loan must be visible to the actor under the normal loan scope.
 *
 * At most one active write-off per loan. A partial unique index would express
 * that in SQL, but Prisma's migration diff does not model partial indexes and
 * would try to drop it; instead the service serialises write-offs of the same
 * loan with a transaction-scoped advisory lock and checks inside it.
 */
import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { buildCreditoVisibilityWhere } from "@/server/auth/scope";
import { assertVersionClaimed, updatedAtMatches } from "@/server/optimistic-lock";
import { parseInput } from "@/server/validation/input";
import { registrarCastigoSchema, revertirCastigoSchema } from "@/features/casa-negocio/schemas";

import { requireCapacidad } from "./capacidades";
import { aDecimal } from "./dinero";
import { CasaNegocioReglaError } from "./errors";
import { ENTIDAD, accion, imagen } from "./shared";

export async function registrarCastigo(raw: unknown): Promise<{ castigoId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const input = parseInput(registrarCastigoSchema, raw);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('casa_negocio.castigo:' || ${input.creditoId}))`;

    const credito = await tx.credito.findFirst({
      where: { id: input.creditoId, ...buildCreditoVisibilityWhere(actor) },
      select: { id: true, monto: true },
    });
    if (!credito) throw new CasaNegocioReglaError("No encontramos ese crédito o no tienes acceso a él.", "creditoId");
    if (input.monto > Number(credito.monto)) {
      throw new CasaNegocioReglaError("Lo castigado no puede superar lo prestado.", "monto");
    }
    const activo = await tx.cnCastigoCredito.findFirst({
      where: { creditoId: credito.id, revertidoEn: null },
      select: { id: true },
    });
    if (activo) throw new CasaNegocioReglaError("Ese crédito ya está marcado como perdido.");

    const castigo = await tx.cnCastigoCredito.create({
      data: {
        creditoId: credito.id,
        monto: aDecimal(input.monto),
        fecha: input.fecha,
        motivo: input.motivo,
        accionPor: actor.id,
      },
    });
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("castigo.registrar"),
      entityType: ENTIDAD.castigo,
      entityId: castigo.id,
      reason: input.motivo,
      after: imagen(castigo),
      metadata: { creditoId: credito.id },
    });
    return { castigoId: castigo.id };
  });
}

export async function revertirCastigo(raw: unknown): Promise<{ castigoId: string }> {
  const actor = await requireCapacidad("CONFIGURAR");
  const { castigoId, version, motivo } = parseInput(revertirCastigoSchema, raw);

  return prisma.$transaction(async (tx) => {
    const antes = await tx.cnCastigoCredito.findFirst({
      where: { id: castigoId, credito: buildCreditoVisibilityWhere(actor) },
    });
    if (!antes) throw new CasaNegocioReglaError("No encontramos ese castigo o no tienes acceso a él.");
    if (antes.revertidoEn) throw new CasaNegocioReglaError("Ese castigo ya fue revertido.");

    const claimed = await tx.cnCastigoCredito.updateMany({
      where: { id: castigoId, revertidoEn: null, actualizadoEn: updatedAtMatches(version) },
      data: { revertidoEn: new Date(), revertidoPor: actor.id, motivoReversion: motivo },
    });
    assertVersionClaimed(claimed.count);
    await recordAuditLogTx(tx, {
      actorId: actor.id,
      action: accion("castigo.revertir"),
      entityType: ENTIDAD.castigo,
      entityId: castigoId,
      reason: motivo,
      before: imagen(antes),
      metadata: { creditoId: antes.creditoId },
    });
    return { castigoId };
  });
}
