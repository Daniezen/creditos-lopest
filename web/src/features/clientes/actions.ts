"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  assertCanMutate,
  requireClienteAccess,
  requireMutationUser,
} from "@/server/auth/scope";

import { fieldErrorsOf, parseInput, type FieldErrors } from "@/server/validation/input";
import type { z } from "zod";

import { actualizarClienteSchema, crearClienteSchema, eliminarClienteSchema } from "./schemas";
import type { ClienteSelectorOption } from "./types";

interface CrearClienteMinimoInput {
  cedula: string;
  nombre: string;
  direccion?: string;
  empresa?: string;
  telefono?: string;
  recomienda?: string;
  contacto?: string;
  contacto2?: string;
}

interface ActualizarClienteInput extends CrearClienteMinimoInput {
  id: string;
  carpetaAdjuntosUrl?: string;
  estadoDocumentos?: "FALTAN_DOCUMENTOS" | "DOCUMENTOS_CARGADOS";
}

interface EliminarClienteInput {
  id: string;
}

type CrearClienteMinimoResult =
  | {
      ok: true;
      cliente: ClienteSelectorOption;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors;
    };

type ClienteMutationResult =
  | {
      ok: true;
      clienteId?: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors;
    };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Result for a payload that failed its schema, before any I/O. */
function invalidInput(error: unknown): { ok: false; error: string; fieldErrors?: FieldErrors } {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Los datos del cliente no son válidos.",
    fieldErrors: fieldErrorsOf(error),
  };
}

/**
 * Determina si un evento representa actividad financiera real.
 *
 * Si existe cualquiera de estos casos, no se debe permitir borrado físico
 * del crédito/cliente sin un flujo de anulación auditado.
 */
function eventoTieneActividadFinanciera(evento: {
  tipo: string;
  estado: string;
  montoPagado: unknown;
  capitalPagado: unknown;
  interesPagado: unknown;
  fechaPago: Date | null;
}): boolean {
  return (
    evento.tipo === "ABONO_CAPITAL" ||
    evento.estado === "PAGADO" ||
    evento.estado === "CANCELADO_POR_ABONO" ||
    Number(evento.montoPagado) > 0 ||
    Number(evento.capitalPagado) > 0 ||
    Number(evento.interesPagado) > 0 ||
    evento.fechaPago !== null
  );
}

/**
 * Crea un cliente mínimo/ampliado para el flujo de creación de crédito.
 *
 * Seguridad:
 * - exige usuario con capacidad de mutación;
 * - asigna ownerUserId al usuario autenticado que crea el cliente;
 * - la reasignación a otro owner debe hacerse luego con flujo admin auditado.
 */
export async function crearClienteMinimo(
  input: CrearClienteMinimoInput,
): Promise<CrearClienteMinimoResult> {
  let data: z.output<typeof crearClienteSchema>;
  try {
    data = parseInput(crearClienteSchema, input);
  } catch (error) {
    return invalidInput(error);
  }

  try {
    const user = await requireMutationUser();

    const cliente = await prisma.cliente.create({
      data: {
        ...data,
        ownerUserId: user.id,
        accionPor: user.id,
      },
      select: {
        id: true,
        cedula: true,
        nombre: true,
        direccion: true,
        empresa: true,
        telefono: true,
        recomienda: true,
        contacto: true,
        contacto2: true,
        carpetaAdjuntosUrl: true,
        estadoDocumentos: true,
      },
    });

    revalidatePath("/creditos/nuevo");
    revalidatePath("/clientes");

    return {
      ok: true,
      cliente,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        error: "Ya existe un cliente con esa cédula.",
      };
    }

    console.error("Error al crear cliente mínimo:", error);

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el cliente.",
    };
  }
}

/**
 * Actualiza un cliente.
 *
 * Seguridad:
 * - valida ownership/ADMIN antes de mutar;
 * - LECTURA queda bloqueado por assertCanMutate.
 */
export async function actualizarCliente(
  input: ActualizarClienteInput,
): Promise<ClienteMutationResult> {
  let data: z.output<typeof actualizarClienteSchema>;
  try {
    data = parseInput(actualizarClienteSchema, input);
  } catch (error) {
    return invalidInput(error);
  }
  const { id, ...campos } = data;
  const { cedula } = campos;

  try {
    const { user } = await requireClienteAccess(id);
    assertCanMutate(user);

    const duplicado = await prisma.cliente.findFirst({
      where: {
        cedula,
        NOT: {
          id,
        },
      },
      select: {
        id: true,
        nombre: true,
      },
    });

    if (duplicado) {
      return {
        ok: false,
        error: `La cédula ya está registrada para ${duplicado.nombre}.`,
      };
    }

    await prisma.cliente.update({
      where: {
        id,
      },
      data: {
        ...campos,
        accionPor: user.id,
      },
    });

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);

    return {
      ok: true,
      clienteId: id,
    };
  } catch (error) {
    console.error("Error al actualizar cliente:", error);

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo actualizar el cliente.",
    };
  }
}

/**
 * Elimina un cliente solo si es seguro.
 *
 * Seguridad:
 * - primero valida ownership/ADMIN;
 * - luego aplica reglas de integridad financiera/documental.
 */
export async function eliminarCliente(
  input: EliminarClienteInput,
): Promise<ClienteMutationResult> {
  let id: string;
  try {
    ({ id } = parseInput(eliminarClienteSchema, input));
  } catch (error) {
    return invalidInput(error);
  }

  try {
    const { user } = await requireClienteAccess(id);
    assertCanMutate(user);

    await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: {
          id,
        },
        include: {
          documentos: {
            select: {
              id: true,
            },
          },
          creditos: {
            include: {
              eventos: {
                select: {
                  id: true,
                  tipo: true,
                  estado: true,
                  montoPagado: true,
                  capitalPagado: true,
                  interesPagado: true,
                  fechaPago: true,
                },
              },
            },
          },
        },
      });

      if (!cliente) {
        throw new Error("El cliente no existe.");
      }

      if (cliente.documentos.length > 0) {
        throw new Error(
          "No se puede eliminar el cliente porque tiene documentos asociados.",
        );
      }

      const tieneActividadFinanciera = cliente.creditos.some((credito) =>
        credito.eventos.some(eventoTieneActividadFinanciera),
      );

      if (tieneActividadFinanciera) {
        throw new Error(
          "No se puede eliminar el cliente porque tiene créditos con pagos, abonos o historial financiero.",
        );
      }

      if (cliente.creditos.length > 0) {
        throw new Error(
          "No se puede eliminar el cliente porque conserva créditos asociados. Borra primero cada crédito elegible para mantener su trazabilidad.",
        );
      }

      await tx.cliente.delete({
        where: {
          id,
        },
      });
    });

    revalidatePath("/clientes");
    revalidatePath("/creditos");

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el cliente.",
    };
  }
}
