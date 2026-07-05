"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { requireRole } from "@/server/auth/guards";

function leerCampoObligatorio(formData: FormData, name: string): string {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta el campo obligatorio ${name}.`);
  }

  return value.trim();
}

function normalizeOptional(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

/**
 * Transfiere el propietario operativo de un credito individual.
 *
 * Regla de dominio:
 * - La cartera financiera vive en Credito.ownerUserId.
 * - Transferir un credito NO mueve Cliente.ownerUserId.
 * - Esto permite que el mismo cliente quede compartido entre cuentas con
 *   creditos distintos para cada propietario.
 *
 * Seguridad:
 * - Solo ADMIN puede transferir creditos entre propietarios.
 * - La operacion queda auditada con before/after.
 */
export async function transferirCreditoOwnerAction(
  formData: FormData,
): Promise<void> {
  try {
    const admin = await requireRole("ADMIN");
    const creditoId = leerCampoObligatorio(formData, "creditoId");
    const targetOwnerUserId = leerCampoObligatorio(formData, "targetOwnerUserId");
    const reason = normalizeOptional(formData.get("reason"));

    const result = await prisma.$transaction(async (tx) => {
      const credito = await tx.credito.findUnique({
        where: {
          id: creditoId,
        },
        include: {
          ownerUser: {
            select: {
              id: true,
              email: true,
              nombre: true,
            },
          },
          cliente: {
            select: {
              id: true,
              nombre: true,
              cedula: true,
            },
          },
        },
      });

      if (!credito) {
        throw new Error("El credito no existe.");
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

      if (credito.ownerUserId === targetOwner.id) {
        throw new Error("El credito ya pertenece al propietario seleccionado.");
      }

      const updated = await tx.credito.update({
        where: {
          id: credito.id,
        },
        data: {
          ownerUserId: targetOwner.id,
          accionPor: admin.id,
        },
        select: {
          id: true,
          clienteId: true,
        },
      });

      await recordAuditLogTx(tx, {
        actorId: admin.id,
        action: "CREDITO_TRANSFER_OWNER",
        entityType: "Credito",
        entityId: credito.id,
        reason,
        before: {
          ownerUserId: credito.ownerUserId,
          ownerEmail: credito.ownerUser?.email ?? null,
          ownerNombre: credito.ownerUser?.nombre ?? null,
        } satisfies Prisma.InputJsonObject,
        after: {
          ownerUserId: targetOwner.id,
          ownerEmail: targetOwner.email,
          ownerNombre: targetOwner.nombre,
        } satisfies Prisma.InputJsonObject,
        metadata: {
          mode: "SINGLE_CREDIT_TRANSFER",
          creditoCodigo: credito.codigo,
          clienteId: credito.cliente.id,
          clienteNombre: credito.cliente.nombre,
          clienteCedula: credito.cliente.cedula,
        } satisfies Prisma.InputJsonObject,
      });

      return updated;
    });

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${result.clienteId}`);
    revalidatePath("/creditos");
    revalidatePath(`/creditos/${result.id}`);
    revalidatePath("/reportes");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "No se pudo transferir el propietario del credito.",
    );
  }
}
