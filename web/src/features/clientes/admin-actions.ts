"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { requireRole } from "@/server/auth/guards";
import { TRANSFER_CLIENTE_FIELDS, transferirClienteSchema } from "@/features/transferencias/schemas";
import { formFields, parseInput } from "@/server/validation/input";

/**
 * Transfiere el propietario principal/documental de un cliente completo.
 *
 * Importante:
 * - Esta accion mueve Cliente.ownerUserId.
 * - Tambien mueve todos los Credito.ownerUserId del cliente.
 * - Para mover un credito individual sin mover el cliente completo, usar
 *   transferirCreditoOwnerAction en features/creditos/admin-actions.
 */
export async function transferirClienteOwnerAction(
  formData: FormData,
): Promise<void> {
  try {
    const admin = await requireRole("ADMIN");
    const { clienteId, targetOwnerUserId, reason } = parseInput(transferirClienteSchema, formFields(formData, TRANSFER_CLIENTE_FIELDS));

    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: {
          id: clienteId,
        },
        include: {
          ownerUser: {
            select: {
              id: true,
              email: true,
              nombre: true,
            },
          },
        },
      });

      if (!cliente) {
        throw new Error("El cliente no existe.");
      }

      const targetOwner = await tx.user.findUnique({
        where: {
          id: targetOwnerUserId,
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          activo: true,
        },
      });

      if (!targetOwner || !targetOwner.activo) {
        throw new Error("El usuario destino no existe o esta inactivo.");
      }

      if (cliente.ownerUserId === targetOwner.id) {
        throw new Error("El cliente ya pertenece al propietario seleccionado.");
      }

      const affectedCredits = await tx.credito.updateMany({
        where: {
          clienteId: cliente.id,
          eliminadoEn: null,
        },
        data: {
          ownerUserId: targetOwner.id,
          accionPor: admin.id,
        },
      });

      const updated = await tx.cliente.update({
        where: {
          id: cliente.id,
        },
        data: {
          ownerUserId: targetOwner.id,
          accionPor: admin.id,
        },
        select: {
          id: true,
        },
      });

      await recordAuditLogTx(tx, {
        actorId: admin.id,
        action: "CLIENTE_TRANSFER_OWNER",
        entityType: "Cliente",
        entityId: cliente.id,
        reason,
        before: {
          ownerUserId: cliente.ownerUserId,
          ownerEmail: cliente.ownerUser?.email ?? null,
          ownerNombre: cliente.ownerUser?.nombre ?? null,
        } satisfies Prisma.InputJsonObject,
        after: {
          ownerUserId: targetOwner.id,
          ownerEmail: targetOwner.email,
          ownerNombre: targetOwner.nombre,
        } satisfies Prisma.InputJsonObject,
        metadata: {
          mode: "FULL_CLIENT_TRANSFER",
          clienteNombre: cliente.nombre,
          clienteCedula: cliente.cedula,
          affectedCredits: affectedCredits.count,
        } satisfies Prisma.InputJsonObject,
      });

      return updated;
    });

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${result.id}`);
    revalidatePath("/creditos");
    revalidatePath("/reportes");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "No se pudo transferir el propietario del cliente.",
    );
  }
}
