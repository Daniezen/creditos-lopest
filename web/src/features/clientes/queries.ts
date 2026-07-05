import {
  EstadoCredito,
  EstadoDocumentos,
  EstadoEventoFinanciero,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { ClienteSelectorOption } from "./types";

interface ObtenerClientesParaListadoParams {
  query?: string;
  estadoDocumentos?: string;
}

export interface ClienteListadoItem {
  id: string;
  cedula: string;
  nombre: string;
  telefono: string | null;
  empresa: string | null;
  direccion: string | null;
  contacto: string | null;
  contacto2: string | null;
  recomienda: string | null;
  carpetaAdjuntosUrl: string | null;
  estadoDocumentos: EstadoDocumentos;

  perfilIncompleto: boolean;
  creditosTotal: number;
  creditosActivos: number;
  saldoTotal: number;
  proximaCuota: {
    creditoId: string;
    codigoCredito: string;
    fechaProgramada: Date;
    valorProgramado: number;
  } | null;
}

/**
 * Obtiene clientes para selectores de UI.
 *
 * Se mantiene separado del listado principal porque el autocomplete necesita
 * un contrato más liviano que la vista completa de cartera por cliente.
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

/**
 * Lista clientes para la vista principal.
 *
 * Calcula métricas derivadas desde créditos/eventos sin persistir resúmenes
 * financieros como fuente de verdad.
 */
export async function obtenerClientesParaListado({
  query,
  estadoDocumentos,
}: ObtenerClientesParaListadoParams = {}): Promise<ClienteListadoItem[]> {
  const normalizedQuery = query?.trim() ?? "";
  const estadoDocumentosFiltro = parseEstadoDocumentos(estadoDocumentos);

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(estadoDocumentosFiltro
        ? {
            estadoDocumentos: estadoDocumentosFiltro,
          }
        : {}),
      ...(normalizedQuery
        ? {
            OR: [
              {
                nombre: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                cedula: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                telefono: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                empresa: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                contacto: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    include: {
      creditos: {
        include: {
          eventos: {
            orderBy: [
              {
                fechaProgramada: "asc",
              },
              {
                numeroCuota: "asc",
              },
            ],
            select: {
              fechaProgramada: true,
              valorProgramado: true,
              saldoCapitalPost: true,
              estado: true,
            },
          },
        },
        orderBy: {
          creadoEn: "desc",
        },
      },
    },
    orderBy: {
      nombre: "asc",
    },
    take: 300,
  });

  return clientes.map((cliente) => {
    const creditosActivos = cliente.creditos.filter(
      (credito) => credito.estado === EstadoCredito.ACTIVO,
    );

    const saldoTotal = creditosActivos.reduce((total, credito) => {
      return total + calcularSaldoCapitalVigente(credito);
    }, 0);

    const proximaCuota =
      creditosActivos
        .flatMap((credito) =>
          credito.eventos
            .filter((evento) => isEstadoProximaCuota(evento.estado))
            .map((evento) => ({
              creditoId: credito.id,
              codigoCredito: credito.codigo,
              fechaProgramada: evento.fechaProgramada,
              valorProgramado: Number(evento.valorProgramado),
            })),
        )
        .sort(
          (a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime(),
        )[0] ?? null;

    return {
      id: cliente.id,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      empresa: cliente.empresa,
      direccion: cliente.direccion,
      contacto: cliente.contacto,
      contacto2: cliente.contacto2,
      recomienda: cliente.recomienda,
      carpetaAdjuntosUrl: cliente.carpetaAdjuntosUrl,
      estadoDocumentos: cliente.estadoDocumentos,

      perfilIncompleto: isPerfilClienteIncompleto(cliente),
      creditosTotal: cliente.creditos.length,
      creditosActivos: creditosActivos.length,
      saldoTotal,
      proximaCuota,
    };
  });
}

export async function obtenerClienteDetalle(id: string) {
  return prisma.cliente.findUnique({
    where: {
      id,
    },
    include: {
      documentos: {
        orderBy: {
          creadoEn: "desc",
        },
      },
      creditos: {
        include: {
          eventos: {
            orderBy: [
              {
                fechaProgramada: "asc",
              },
              {
                numeroCuota: "asc",
              },
            ],
          },
        },
        orderBy: {
          creadoEn: "desc",
        },
      },
    },
  });
}

function parseEstadoDocumentos(
  value: string | undefined,
): EstadoDocumentos | null {
  if (value === EstadoDocumentos.FALTAN_DOCUMENTOS) {
    return EstadoDocumentos.FALTAN_DOCUMENTOS;
  }

  if (value === EstadoDocumentos.DOCUMENTOS_CARGADOS) {
    return EstadoDocumentos.DOCUMENTOS_CARGADOS;
  }

  return null;
}

function isEstadoProximaCuota(estado: EstadoEventoFinanciero): boolean {
  return (
    estado === EstadoEventoFinanciero.PENDIENTE ||
    estado === EstadoEventoFinanciero.ATRASADO ||
    estado === EstadoEventoFinanciero.MORA
  );
}

function isPerfilClienteIncompleto(cliente: {
  telefono: string | null;
  direccion: string | null;
  estadoDocumentos: EstadoDocumentos;
}): boolean {
  return (
    !cliente.telefono ||
    !cliente.direccion ||
    cliente.estadoDocumentos === EstadoDocumentos.FALTAN_DOCUMENTOS
  );
}


function calcularSaldoCapitalVigente(credito: {
  monto: unknown;
  eventos: {
    estado: EstadoEventoFinanciero;
    saldoCapitalPost: unknown | null;
  }[];
}): number {
  const ultimoEventoPagadoConSaldo = [...credito.eventos]
    .reverse()
    .find(
      (evento) =>
        evento.estado === EstadoEventoFinanciero.PAGADO &&
        evento.saldoCapitalPost !== null,
    );

  return ultimoEventoPagadoConSaldo?.saldoCapitalPost !== null &&
    ultimoEventoPagadoConSaldo?.saldoCapitalPost !== undefined
    ? Number(ultimoEventoPagadoConSaldo.saldoCapitalPost)
    : Number(credito.monto);
}
