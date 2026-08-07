import {
  EstadoCredito,
  EstadoEventoFinanciero,
  TipoEventoFinanciero,
  type FrecuenciaPago,
  type TipoAmortizacion,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { buildCreditoVisibilityWhere } from "@/server/auth/scope";
import { isAbonoReversible } from "@/features/creditos/abonos/reversibility";
import { puedeRevertirAbonoRecalculando } from "@/features/creditos/abonos/recalculated-reversal-policy";
import {
  calcularResumenCreditos,
  derivarCreditoOperativo,
  type CreditoResumenFuente,
  type SegmentoCreditos,
} from "@/features/creditos/portfolio-summary";

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
  interesPendiente: number;
  tieneCuotasVencidas: boolean;
  proximaCuota: {
    creditoId: string;
    codigoCredito: string;
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
            }) || puedeRevertirAbonoRecalculando({
              abonoId: evento.id,
              abonoCreadoEn: evento.creadoEn,
              tipoAmortizacion: credito.tipoAmortizacion,
              eventos: credito.eventos,
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
          tipo: true,
          fechaProgramada: true,
          valorProgramado: true,
          interesProgramado: true,
          capitalPagado: true,
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
    const operativo = derivarCreditoOperativo({
      id: credito.id,
      codigo: credito.codigo,
      estado: credito.estado,
      monto: Number(credito.monto),
      fechaCancelacion: credito.fechaCancelacion,
      eventos: credito.eventos.map((evento) => ({
        numeroCuota: evento.numeroCuota,
        tipo: evento.tipo,
        estado: evento.estado,
        fechaProgramada: evento.fechaProgramada,
        valorProgramado: Number(evento.valorProgramado),
        interesProgramado: Number(evento.interesProgramado),
        capitalPagado: Number(evento.capitalPagado),
        saldoCapitalPost:
          evento.saldoCapitalPost === null
            ? null
            : Number(evento.saldoCapitalPost),
      })),
    });

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

      saldoCapital: operativo.saldoCapital,
      interesPendiente: operativo.interesPendiente,
      tieneCuotasVencidas: operativo.tieneCuotasVencidas,

      proximaCuota: operativo.proximaCuota
        ? {
            creditoId: operativo.proximaCuota.creditoId,
            codigoCredito: operativo.proximaCuota.codigoCredito,
            numeroCuota: operativo.proximaCuota.numeroCuota,
            fechaProgramada: operativo.proximaCuota.fechaProgramada,
            valorProgramado: operativo.proximaCuota.valorProgramado,
            estado: operativo.proximaCuota.estado,
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

export const CREDITOS_PAGE_SIZE = 200;

export interface ObtenerVistaCreditosParams {
  query?: string;
  estado?: string;
  page?: number;
}

export interface VistaCreditosPaginada {
  items: CreditoListadoItem[];
  page: number;
  pageSize: number;
  totalCoincidencias: number;
  totalPaginas: number;
  resumenSegmento: ReturnType<typeof calcularResumenCreditos>;
  resumenVisible: ReturnType<typeof calcularResumenCreditos>;
}

/**
 * Loads one page of Credits while calculating counts and financial metrics over
 * every authorized match. Pagination never changes cards, totals or statistics.
 */
export async function obtenerVistaCreditos({
  query,
  estado,
  page = 1,
}: ObtenerVistaCreditosParams = {}): Promise<VistaCreditosPaginada> {
  const user = await requireUser();
  const normalizedQuery = query?.trim() ?? "";
  const segmento = parseSegmentoCreditos(estado);
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const where = {
    AND: [
      buildCreditoVisibilityWhere(user),
      buildCreditFunctionalWhere(normalizedQuery, segmento),
    ],
  };

  const eventSelect = {
    tipo: true,
    estado: true,
    fechaProgramada: true,
    valorProgramado: true,
    interesProgramado: true,
    capitalPagado: true,
    saldoCapitalPost: true,
  } as const;

  const [totalCoincidencias, summaryCredits, pageCredits] = await Promise.all([
    prisma.credito.count({ where }),
    prisma.credito.findMany({
      where,
      select: {
        id: true,
        codigo: true,
        estado: true,
        monto: true,
        fechaCancelacion: true,
        eventos: {
          orderBy: [{ fechaProgramada: "asc" }, { numeroCuota: "asc" }],
          select: eventSelect,
        },
      },
    }),
    prisma.credito.findMany({
      where,
      include: {
        cliente: {
          select: { id: true, cedula: true, nombre: true, telefono: true },
        },
        eventos: {
          orderBy: [{ fechaProgramada: "asc" }, { numeroCuota: "asc" }],
          select: {
            numeroCuota: true,
            ...eventSelect,
          },
        },
      },
      orderBy: { creadoEn: "desc" },
      skip: (safePage - 1) * CREDITOS_PAGE_SIZE,
      take: CREDITOS_PAGE_SIZE,
    }),
  ]);

  const summarySources = summaryCredits.map(toCreditoResumenFuente);
  const pageSources = pageCredits.map(toCreditoResumenFuente);
  const derivedById = new Map(
    pageSources.map((credito) => [credito.id, derivarCreditoOperativo(credito)]),
  );

  const items = pageCredits.map((credito) => {
    const derived = derivedById.get(credito.id);
    if (!derived) throw new Error(`No se pudo derivar el crédito ${credito.id}.`);

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
      saldoCapital: derived.saldoCapital,
      interesPendiente: derived.interesPendiente,
      tieneCuotasVencidas: derived.tieneCuotasVencidas,
      proximaCuota: derived.proximaCuota
        ? {
            creditoId: credito.id,
            codigoCredito: credito.codigo,
            numeroCuota: derived.proximaCuota.numeroCuota,
            fechaProgramada: derived.proximaCuota.fechaProgramada,
            valorProgramado: derived.proximaCuota.valorProgramado,
            estado: derived.proximaCuota.estado,
          }
        : null,
    };
  });

  return {
    items,
    page: safePage,
    pageSize: CREDITOS_PAGE_SIZE,
    totalCoincidencias,
    totalPaginas: Math.max(1, Math.ceil(totalCoincidencias / CREDITOS_PAGE_SIZE)),
    resumenSegmento: calcularResumenCreditos(summarySources, segmento),
    resumenVisible: calcularResumenCreditos(pageSources, segmento),
  };
}

function parseSegmentoCreditos(value: string | undefined): SegmentoCreditos {
  if (value === "ACTIVO" || value === "VENCIDA" || value === "CANCELADO") {
    return value;
  }
  return "TODOS";
}

function buildCreditFunctionalWhere(
  normalizedQuery: string,
  segmento: SegmentoCreditos,
) {
  const searchWhere = normalizedQuery
    ? {
        OR: [
          { codigo: { contains: normalizedQuery, mode: "insensitive" as const } },
          { cliente: { nombre: { contains: normalizedQuery, mode: "insensitive" as const } } },
          { cliente: { cedula: { contains: normalizedQuery, mode: "insensitive" as const } } },
          { cliente: { telefono: { contains: normalizedQuery, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const segmentWhere = segmento === "ACTIVO"
    ? { estado: EstadoCredito.ACTIVO }
    : segmento === "CANCELADO"
      ? { estado: EstadoCredito.CANCELADO }
      : segmento === "VENCIDA"
        ? {
            estado: EstadoCredito.ACTIVO,
            eventos: {
              some: {
                tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
                estado: { in: [EstadoEventoFinanciero.ATRASADO, EstadoEventoFinanciero.MORA] },
              },
            },
          }
        : {};

  return { ...searchWhere, ...segmentWhere };
}

function toCreditoResumenFuente(credito: {
  id: string;
  codigo: string;
  estado: EstadoCredito;
  monto: unknown;
  fechaCancelacion: Date | null;
  eventos: Array<{
    numeroCuota?: number | null;
    tipo: TipoEventoFinanciero;
    estado: EstadoEventoFinanciero;
    fechaProgramada: Date;
    valorProgramado: unknown;
    interesProgramado: unknown;
    capitalPagado: unknown;
    saldoCapitalPost: unknown | null;
  }>;
}): CreditoResumenFuente {
  return {
    id: credito.id,
    codigo: credito.codigo,
    estado: credito.estado,
    monto: Number(credito.monto),
    fechaCancelacion: credito.fechaCancelacion,
    eventos: credito.eventos.map((evento) => ({
      numeroCuota: evento.numeroCuota ?? null,
      tipo: evento.tipo,
      estado: evento.estado,
      fechaProgramada: evento.fechaProgramada,
      valorProgramado: Number(evento.valorProgramado),
      interesProgramado: Number(evento.interesProgramado),
      capitalPagado: Number(evento.capitalPagado),
      saldoCapitalPost:
        evento.saldoCapitalPost === null ? null : Number(evento.saldoCapitalPost),
    })),
  };
}
