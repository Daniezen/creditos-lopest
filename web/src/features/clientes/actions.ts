"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

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
    };

type ClienteMutationResult =
  | {
      ok: true;
      clienteId?: string;
    }
  | {
      ok: false;
      error: string;
    };

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function normalizeOptional(value: string | undefined): string | null {
  return value?.trim() || null;
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
 */
export async function crearClienteMinimo(
  input: CrearClienteMinimoInput,
): Promise<CrearClienteMinimoResult> {
  const cedula = input.cedula.trim();
  const nombre = input.nombre.trim();

  if (!cedula) {
    return {
      ok: false,
      error: "La cédula es obligatoria.",
    };
  }

  if (!nombre) {
    return {
      ok: false,
      error: "El nombre del cliente es obligatorio.",
    };
  }

  try {
    const cliente = await prisma.cliente.create({
      data: {
        cedula,
        nombre,
        direccion: normalizeOptional(input.direccion),
        empresa: normalizeOptional(input.empresa),
        telefono: normalizeOptional(input.telefono),
        recomienda: normalizeOptional(input.recomienda),
        contacto: normalizeOptional(input.contacto),
        contacto2: normalizeOptional(input.contacto2),
        accionPor: "sistema",
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
      error: "No se pudo crear el cliente.",
    };
  }
}

/**
 * Actualiza un cliente.
 *
 * A diferencia de Sheets, cambiar cédula no requiere propagar a créditos:
 * la relación real es Cliente.id -> Credito.clienteId.
 */
export async function actualizarCliente(
  input: ActualizarClienteInput,
): Promise<ClienteMutationResult> {
  const id = input.id.trim();
  const cedula = input.cedula.trim();
  const nombre = input.nombre.trim();

  if (!id) {
    return {
      ok: false,
      error: "Cliente inválido.",
    };
  }

  if (!cedula) {
    return {
      ok: false,
      error: "La cédula es obligatoria.",
    };
  }

  if (!nombre) {
    return {
      ok: false,
      error: "El nombre del cliente es obligatorio.",
    };
  }

  try {
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
        cedula,
        nombre,
        direccion: normalizeOptional(input.direccion),
        empresa: normalizeOptional(input.empresa),
        telefono: normalizeOptional(input.telefono),
        recomienda: normalizeOptional(input.recomienda),
        contacto: normalizeOptional(input.contacto),
        contacto2: normalizeOptional(input.contacto2),
        carpetaAdjuntosUrl: normalizeOptional(input.carpetaAdjuntosUrl),
        estadoDocumentos: input.estadoDocumentos ?? "FALTAN_DOCUMENTOS",
        accionPor: "sistema",
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
      error: "No se pudo actualizar el cliente.",
    };
  }
}

/**
 * Elimina un cliente solo si es seguro.
 *
 * Permite el caso operativo importante:
 * - cliente creado por error;
 * - crédito creado vacío/sin pagos;
 * - se permite borrar cliente y créditos vacíos asociados.
 *
 * Bloquea si existe actividad financiera o documentos.
 */
export async function eliminarCliente(
  input: EliminarClienteInput,
): Promise<ClienteMutationResult> {
  const id = input.id.trim();

  if (!id) {
    return {
      ok: false,
      error: "Cliente inválido.",
    };
  }

  try {
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

      const creditoIds = cliente.creditos.map((credito) => credito.id);

      if (creditoIds.length > 0) {
        await tx.eventoFinanciero.deleteMany({
          where: {
            creditoId: {
              in: creditoIds,
            },
          },
        });

        await tx.credito.deleteMany({
          where: {
            id: {
              in: creditoIds,
            },
          },
        });
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
