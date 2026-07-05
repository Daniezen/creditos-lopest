import {
  EstadoCredito,
  EstadoEventoFinanciero,
  type FrecuenciaPago,
  type TipoAmortizacion,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface ObtenerCreditosParaListadoParams {
  query?: string;
  estado?: string;
}

export interface CreditoListadoItem {
  id: string;
  codigo: string;
  estado: EstadoCredito;
  fechaPrestamo: Date;

  monto: number;
  plazoMeses: number;
  tasaMensual: number;

  frecuencia: FrecuenciaPago;
  tipoAmortizacion: TipoAmortizacion;

  cliente: {
    id: string;
    cedula: string;
    nombre: string;
    telefono: string | null;
  };

  saldoCapital: number;
  proximaCuota: {
    numeroCuota: number | null;
    fechaProgramada: Date;
    valorProgramado: number;
    estado: EstadoEventoFinanciero;
  } | null;
}

export async function obtenerCreditoDetalle(id: string) {
  return prisma.credito.findUnique({
    where: {
      id,
    },
    include: {
      cliente: {
        select: {
          id: true,
          cedula: true,
          nombre: true,
          telefono: true,
        },
      },
      eventos: {
        orderBy: [
          {
            numeroCuota: "asc",
          },
          {
            creadoEn: "asc",
          },
        ],
      },
    },
  });
}

/**
 * Obtiene créditos para la vista principal de cartera.
 *
 * Decisiones:
 * - Búsqueda global por código, cliente, cédula o teléfono.
 * - Filtro simple por estado.
 * - Incluye eventos para calcular saldo y próxima cuota sin guardar resúmenes
 *   derivados como fuente de verdad.
 *
 * Este enfoque es suficiente para la fase actual. Cuando haya volumen real,
 * se puede optimizar con SQL agregado o vistas materializadas.
 */
export async function obtenerCreditosParaListado({
  query,
  estado,
}: ObtenerCreditosParaListadoParams = {}): Promise<CreditoListadoItem[]> {
  const normalizedQuery = query?.trim() ?? "";
  const estadoFiltro = parseEstadoCredito(estado);

  const creditos = await prisma.credito.findMany({
    where: {
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              {
                codigo: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
              {
                cliente: {
                  nombre: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
              },
              {
                cliente: {
                  cedula: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
              },
              {
                cliente: {
                  telefono: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      cliente: {
        select: {
          id: true,
          cedula: true,
          nombre: true,
          telefono: true,
        },
      },
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
          numeroCuota: true,
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
    take: 200,
  });

  return creditos.map((credito) => {
    const saldoCapitalVigente = calcularSaldoCapitalVigente(credito);

    const proximaCuota =
      credito.eventos.find((evento) =>
        isEstadoProximaCuota(evento.estado),
      ) ?? null;

    return {
      id: credito.id,
      codigo: credito.codigo,
      estado: credito.estado,
      fechaPrestamo: credito.fechaPrestamo,

      monto: Number(credito.monto),
      plazoMeses: Number(credito.plazoMeses),
      tasaMensual: Number(credito.tasaMensual),

      frecuencia: credito.frecuencia,
      tipoAmortizacion: credito.tipoAmortizacion,

      cliente: credito.cliente,

      saldoCapital: saldoCapitalVigente,

      proximaCuota: proximaCuota
        ? {
            numeroCuota: proximaCuota.numeroCuota,
            fechaProgramada: proximaCuota.fechaProgramada,
            valorProgramado: Number(proximaCuota.valorProgramado),
            estado: proximaCuota.estado,
          }
        : null,
    };
  });
}

function parseEstadoCredito(value: string | undefined): EstadoCredito | null {
  if (value === EstadoCredito.ACTIVO) {
    return EstadoCredito.ACTIVO;
  }

  if (value === EstadoCredito.CANCELADO) {
    return EstadoCredito.CANCELADO;
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
