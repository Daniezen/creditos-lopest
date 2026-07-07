"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";

import {
  assertTransferPairAllowed,
  canTransferAcrossAllOwners,
  requireTransferenciasUser,
} from "./queries";

export interface TransferActionState {
  ok: boolean;
  message: string | null;
}

export const initialTransferActionState: TransferActionState = {
  ok: false,
  message: null,
};

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

async function obtenerTargetOwner(tx: Prisma.TransactionClient, targetOwnerUserId: string) {
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

  return targetOwner;
}

export async function transferirClienteCompletoAction(
  _previousState: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  try {
    const user = await requireTransferenciasUser();
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
          creditos: {
            select: {
              id: true,
              ownerUser: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!cliente) {
        throw new Error("El cliente no existe.");
      }

      const targetOwner = await obtenerTargetOwner(tx, targetOwnerUserId);

      if (cliente.ownerUserId === targetOwner.id) {
        throw new Error("El cliente ya pertenece al propietario seleccionado.");
      }

      if (!canTransferAcrossAllOwners(user)) {
        const sourceOwnerEmail =
          cliente.ownerUser?.email ??
          cliente.creditos.find((credito) => credito.ownerUser?.email)?.ownerUser?.email ??
          null;

        assertTransferPairAllowed({
          user,
          sourceOwnerEmail,
          targetOwnerEmail: targetOwner.email,
        });
      }

      const affectedCredits = await tx.credito.updateMany({
        where: {
          clienteId: cliente.id,
        },
        data: {
          ownerUserId: targetOwner.id,
          accionPor: user.id,
        },
      });

      const updated = await tx.cliente.update({
        where: {
          id: cliente.id,
        },
        data: {
          ownerUserId: targetOwner.id,
          accionPor: user.id,
        },
        select: {
          id: true,
        },
      });

      await recordAuditLogTx(tx, {
        actorId: user.id,
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

      return {
        id: updated.id,
        clienteNombre: cliente.nombre,
        targetOwnerNombre: targetOwner.nombre,
        affectedCredits: affectedCredits.count,
      };
    });

    revalidatePath("/transferencias");
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${result.id}`);
    revalidatePath("/creditos");
    revalidatePath("/reportes");

    return {
      ok: true,
      message: `Cliente ${result.clienteNombre} transferido a ${result.targetOwnerNombre}. Créditos movidos: ${result.affectedCredits}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo transferir el cliente completo.",
    };
  }
}

export async function transferirCreditoIndividualAction(
  _previousState: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  try {
    const user = await requireTransferenciasUser();
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
              cedula: true,
              nombre: true,
            },
          },
        },
      });

      if (!credito) {
        throw new Error("El crédito no existe.");
      }

      const targetOwner = await obtenerTargetOwner(tx, targetOwnerUserId);

      if (credito.ownerUserId === targetOwner.id) {
        throw new Error("El crédito ya pertenece al propietario seleccionado.");
      }

      assertTransferPairAllowed({
        user,
        sourceOwnerEmail: credito.ownerUser?.email ?? null,
        targetOwnerEmail: targetOwner.email,
      });

      const updated = await tx.credito.update({
        where: {
          id: credito.id,
        },
        data: {
          ownerUserId: targetOwner.id,
          accionPor: user.id,
        },
        select: {
          id: true,
          clienteId: true,
        },
      });

      await recordAuditLogTx(tx, {
        actorId: user.id,
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

      return {
        id: updated.id,
        clienteId: updated.clienteId,
        creditoCodigo: credito.codigo,
        targetOwnerNombre: targetOwner.nombre,
      };
    });

    revalidatePath("/transferencias");
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${result.clienteId}`);
    revalidatePath("/creditos");
    revalidatePath(`/creditos/${result.id}`);
    revalidatePath("/reportes");

    return {
      ok: true,
      message: `Crédito ${result.creditoCodigo} transferido a ${result.targetOwnerNombre}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo transferir el crédito.",
    };
  }
}
