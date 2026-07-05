import {
  EstadoCredito,
  EstadoDocumentos,
  EstadoEventoFinanciero,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { buildClienteVisibilityWhere } from "@/server/auth/scope";

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
 * Regla de seguridad:
 * - ADMIN ve todos.
 * - OPERADOR/LECTURA solo ven clientes propios via ownerUserId.
 *
 * Se mantiene separado del listado principal porque el autocomplete necesita
 * un contrato mas liviano que la vista completa de cartera por cliente.
 */
export async function obtenerClientesParaSelector(): Promise<
  ClienteSelectorOption[]
> {
  const user = await requireUser();

  const clientes = await prisma.cliente.findMany({
    where: buildClienteVisibilityWhere(user),
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
 * Calcula metricas derivadas desde creditos/eventos sin persistir resumenes
 * financieros como fuente de verdad.
 *
 * Regla de seguridad:
 * - El filtro de ownership se aplica en la query, no en la UI.
 */
export async function obtenerClientesParaListado({
  query,
  estadoDocumentos,
}: ObtenerClientesParaListadoParams = {}): Promise<ClienteListadoItem[]> {
  const user = await requireUser();
  const normalizedQuery = query?.trim() ?? "";
  const estadoDocumentosFiltro = parseEstadoDocumentos(estadoDocumentos);

  const filtrosFuncionales = {
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
                mode: "insensitive" as const,
              },
            },
            {
              cedula: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              telefono: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              empresa: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              contacto: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const clientes = await prisma.cliente.findMany({
    where: {
      AND: [buildClienteVisibilityWhere(user), filtrosFuncionales],
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

/**
 * Obtiene detalle de cliente aplicando ownership en servidor.
 *
 * No se usa findUnique porque findUnique por id ignoraria ownerUserId.
 */
export async function obtenerClienteDetalle(id: string) {
  const user = await requireUser();

  return prisma.cliente.findFirst({
    where: {
      AND: [
        {
          id,
        },
        buildClienteVisibilityWhere(user),
      ],
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
