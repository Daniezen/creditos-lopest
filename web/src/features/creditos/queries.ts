import {
  EstadoCredito,
  EstadoEventoFinanciero,
  type FrecuenciaPago,
  type TipoAmortizacion,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { buildCreditoVisibilityWhere } from "@/server/auth/scope";
import { isAbonoReversible } from "@/features/creditos/abonos/reversibility";

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

/**
 * Obtiene detalle de credito aplicando ownership en servidor.
 *
 * No se usa findUnique porque findUnique por id ignoraria el ownerUserId
 * ubicado en la relacion credito -> cliente.
 */
export async function obtenerCreditoDetalle(id: string) {
  const user = await requireUser();
  const credito = await prisma.credito.findFirst({
    where: {
      AND: [
        { id },
        buildCreditoVisibilityWhere(user),
      ],
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
        include: {
          abonoSnapshot: true,
        },
        orderBy: [
          { numeroCuota: "asc" },
          { creadoEn: "asc" },
        ],
      },
    },
  });

  if (!credito) return null;

  return {
    ...credito,
    eventos: credito.eventos.map((evento) => ({
      ...evento,
      abonoPuedeRevertirse:
        evento.tipo === "ABONO_CAPITAL" && evento.abonoSnapshot
          ? isAbonoReversible({
              eventosDespues: evento.abonoSnapshot.eventosDespues,
              currentEvents: credito.eventos,
            })
          : false,
    })),
  };
}
/**
 * Obtiene creditos para la vista principal de cartera.
 *
 * Decisiones:
 * - Busqueda global por codigo, cliente, cedula o telefono.
 * - Filtro simple por estado.
 * - Incluye eventos para calcular saldo y proxima cuota sin guardar resumenes
 *   derivados como fuente de verdad.
 *
 * Regla de seguridad:
 * - ADMIN ve todos.
 * - OPERADOR/LECTURA solo ven creditos cuyo cliente pertenece a su ownerUserId.
 */
export async function obtenerCreditosParaListado({
  query,
  estado,
}: ObtenerCreditosParaListadoParams = {}): Promise<CreditoListadoItem[]> {
  const user = await requireUser();
  const normalizedQuery = query?.trim() ?? "";
  const estadoFiltro = parseEstadoCredito(estado);

  const filtrosFuncionales = {
    ...(estadoFiltro ? { estado: estadoFiltro } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              codigo: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              cliente: {
                nombre: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              cliente: {
                cedula: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              cliente: {
                telefono: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const creditos = await prisma.credito.findMany({
    where: {
      AND: [buildCreditoVisibilityWhere(user), filtrosFuncionales],
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
