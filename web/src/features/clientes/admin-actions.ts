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
 * Transfiere el propietario operativo de un cliente.
 *
 * Regla arquitectónica:
 * - No se migran créditos, cuotas ni documentos.
 * - La propiedad vive en Cliente.ownerUserId.
 * - Al cambiar el owner del cliente, la visibilidad de créditos/cuotas cambia
 *   automáticamente por los scopes credito -> cliente -> ownerUserId.
 *
 * Restricción técnica:
 * - Esta action se usa directamente como <form action={...}>.
 * - Por contrato de React/Next, una form action debe retornar void/Promise<void>.
 * - Si luego queremos mostrar feedback inline, debe migrarse a useActionState en
 *   un componente cliente; no se debe devolver un objeto desde esta action.
 */
export async function transferirClienteOwnerAction(
  formData: FormData,
): Promise<void> {
  try {
    const admin = await requireRole("ADMIN");
    const clienteId = leerCampoObligatorio(formData, "clienteId");
    const targetOwnerUserId = leerCampoObligatorio(formData, "targetOwnerUserId");
    const reason = normalizeOptional(formData.get("reason"));

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
        throw new Error("El usuario destino no existe o está inactivo.");
      }

      if (cliente.ownerUserId === targetOwner.id) {
        throw new Error("El cliente ya pertenece al propietario seleccionado.");
      }

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
          clienteNombre: cliente.nombre,
          clienteCedula: cliente.cedula,
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
