import { prisma } from "@/lib/prisma";

import type { ClienteSelectorOption } from "./types";

/**
 * Obtiene clientes para selector.
 *
 * Esta query se ejecuta en servidor. No debe importarse desde componentes
 * cliente directamente.
 */
export async function obtenerClientesParaSelector(): Promise<
  ClienteSelectorOption[]
> {
  const clientes = await prisma.cliente.findMany({
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
    orderBy: {
      nombre: "asc",
    },
    take: 300,
  });

  return clientes;
}