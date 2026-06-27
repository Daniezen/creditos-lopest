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

type CrearClienteMinimoResult =
  | {
      ok: true;
      cliente: ClienteSelectorOption;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Determina si un error desconocido corresponde a una violación de restricción
 * única de Prisma.
 *
 * No importamos el namespace Prisma porque el cliente generado puede variar
 * según versión/configuración del generator. Para este action solo necesitamos
 * identificar el código estable de Prisma: P2002.
 */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Crea un cliente mínimo/ampliado para el flujo de creación de crédito.
 *
 * Diferencia contra Apps Script:
 * - En Sheets existía cedula_nombre como campo auxiliar.
 * - En PostgreSQL no se persiste cedula_nombre porque es dato derivado.
 *
 * Diferencia estructural crítica:
 * - En Sheets se propagaba cambio de cédula a Créditos.
 * - En PostgreSQL los créditos se relacionan por clienteId, no por cedula.
 */
export async function crearClienteMinimo(
  input: CrearClienteMinimoInput,
): Promise<CrearClienteMinimoResult> {
  const cedula = input.cedula.trim();
  const nombre = input.nombre.trim();

  const direccion = input.direccion?.trim() || null;
  const empresa = input.empresa?.trim() || null;
  const telefono = input.telefono?.trim() || null;
  const recomienda = input.recomienda?.trim() || null;
  const contacto = input.contacto?.trim() || null;
  const contacto2 = input.contacto2?.trim() || null;

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
        direccion,
        empresa,
        telefono,
        recomienda,
        contacto,
        contacto2,

        /**
         * Temporal mientras no exista autenticación real.
         * Cuando implementemos usuarios/sesiones, este valor debe venir del
         * usuario autenticado.
         */
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