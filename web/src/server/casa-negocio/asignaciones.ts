/**
 * Account assignment of automatic movements ("¿Dónde entró?" / "¿De dónde
 * salió?"). Créditos is not touched in this unit, so a paid installment or a
 * disbursement reaches the module without an account; the person picks it in
 * Negocio and the choice is stored in "cn_asignaciones_cuenta", never on the
 * loan rows.
 *
 * The loan must be visible to the actor under the existing scope rules
 * (`buildEventoFinancieroVisibilityWhere` / `buildCreditoVisibilityWhere`),
 * so nobody assigns accounts to movements of loans they cannot see.
 */
import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { buildCreditoVisibilityWhere, buildEventoFinancieroVisibilityWhere } from "@/server/auth/scope";
import { ConcurrentModificationError, assertVersionClaimed, updatedAtMatches } from "@/server/optimistic-lock";
import { parseInput } from "@/server/validation/input";
import { asignarCuentaSchema } from "@/features/casa-negocio/schemas";

import { requireCapacidad } from "./capacidades";
import { CasaNegocioReglaError } from "./errors";
import { ENTIDAD, accion, esViolacionUnica, imagen } from "./shared";

export async function asignarCuenta(raw: unknown): Promise<{ asignacionId: string }> {
  const actor = await requireCapacidad("ANOTAR");
  const input = parseInput(asignarCuentaSchema, raw);

  try {
    return await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cnCuenta.findUnique({
        where: { id: input.cuentaId },
        select: { id: true, nombre: true, grupo: true, archivada: true, fechaSaldoInicial: true },
      });
      if (!cuenta) throw new CasaNegocioReglaError("La cuenta indicada no existe.", "cuentaId");
      if (cuenta.archivada) throw new CasaNegocioReglaError(`La cuenta ${cuenta.nombre} está archivada.`, "cuentaId");
      // Cobros and disbursements are business money (spec §3).
      if (cuenta.grupo !== "NEGOCIO") {
        throw new CasaNegocioReglaError("Los cobros y desembolsos van a una cuenta del negocio.", "cuentaId");
      }

      // Date of the automatic movement, to respect the account's opening date.
      let fecha: Date;
      if (input.eventoFinancieroId) {
        const evento = await tx.eventoFinanciero.findFirst({
          where: {
            id: input.eventoFinancieroId,
            // Owner scope of the event plus "loan not soft-deleted".
            AND: [buildEventoFinancieroVisibilityWhere(actor), { credito: buildCreditoVisibilityWhere(actor) }],
          },
          select: { estado: true, fechaPago: true },
        });
        if (!evento) throw new CasaNegocioReglaError("No encontramos ese cobro o no tienes acceso a él.");
        if (evento.estado !== "PAGADO" || !evento.fechaPago) {
          throw new CasaNegocioReglaError("Solo se asigna cuenta a cobros ya pagados.");
        }
        fecha = evento.fechaPago;
      } else {
        const credito = await tx.credito.findFirst({
          where: { id: input.creditoId!, ...buildCreditoVisibilityWhere(actor) },
          select: { fechaPrestamo: true },
        });
        if (!credito) throw new CasaNegocioReglaError("No encontramos ese desembolso o no tienes acceso a él.");
        fecha = credito.fechaPrestamo;
      }
      if (fecha.getTime() < cuenta.fechaSaldoInicial.getTime()) {
        throw new CasaNegocioReglaError(
          `La cuenta ${cuenta.nombre} arranca después de ese movimiento; lo anterior queda sin cuenta.`,
          "cuentaId",
        );
      }

      const clave = input.eventoFinancieroId
        ? { eventoFinancieroId: input.eventoFinancieroId }
        : { creditoId: input.creditoId! };
      const antes = await tx.cnAsignacionCuenta.findUnique({ where: clave });

      if (!antes) {
        // A version on a missing row means someone removed it meanwhile; a
        // missing version on an existing row means a stale "sin cuenta" form.
        if (input.version) throw new ConcurrentModificationError();
        const creada = await tx.cnAsignacionCuenta.create({
          data: { ...clave, cuentaId: cuenta.id, accionPor: actor.id },
        });
        await recordAuditLogTx(tx, {
          actorId: actor.id,
          action: accion("asignacion.crear"),
          entityType: ENTIDAD.asignacion,
          entityId: creada.id,
          after: imagen(creada),
        });
        return { asignacionId: creada.id };
      }

      if (!input.version) throw new ConcurrentModificationError();
      const claimed = await tx.cnAsignacionCuenta.updateMany({
        where: { id: antes.id, actualizadoEn: updatedAtMatches(input.version) },
        data: { cuentaId: cuenta.id, accionPor: actor.id },
      });
      assertVersionClaimed(claimed.count);
      const despues = await tx.cnAsignacionCuenta.findUniqueOrThrow({ where: { id: antes.id } });
      await recordAuditLogTx(tx, {
        actorId: actor.id,
        action: accion("asignacion.cambiar"),
        entityType: ENTIDAD.asignacion,
        entityId: antes.id,
        before: imagen(antes),
        after: imagen(despues),
      });
      return { asignacionId: antes.id };
    });
  } catch (error) {
    // Two people assigned the same cobro at once: the unique key let one win.
    if (esViolacionUnica(error)) throw new ConcurrentModificationError();
    throw error;
  }
}
