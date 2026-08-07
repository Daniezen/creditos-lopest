import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { buildCreditoVisibilityWhere } from "@/server/auth/scope";

import {
  buildCreditFacetCatalogs,
  matchesCreditFilters,
  type CreditFacetCatalogs,
  type CreditFacetFilters,
  type CreditFacetSource,
} from "./credit-facets";
import { calcularResumenCreditos, type ResumenCreditos } from "./portfolio-summary";
import { CREDITOS_PAGE_SIZE, type CreditoListadoItem } from "./queries";
import { derivarCreditoOperativo } from "./portfolio-summary";

export interface FacetedCreditView {
  items: CreditoListadoItem[];
  page: number;
  pageSize: number;
  totalCoincidencias: number;
  totalPaginas: number;
  resumenSegmento: ResumenCreditos;
  resumenVisible: ResumenCreditos;
  facetas: CreditFacetCatalogs;
}

/**
 * Loads the authorized Credit universe once, applies derived financial facets,
 * calculates global catalogs and metrics, then paginates only the matching IDs.
 */
export async function obtenerVistaCreditosFacetada(
  filters: CreditFacetFilters,
  requestedPage = 1,
): Promise<FacetedCreditView> {
  const user = await requireUser();
  const authorized = await prisma.credito.findMany({
    where: buildCreditoVisibilityWhere(user),
    select: {
      id: true,
      codigo: true,
      estado: true,
      creadoEn: true,
      fechaPrestamo: true,
      fechaCancelacion: true,
      monto: true,
      plazoMeses: true,
      tasaMensual: true,
      frecuencia: true,
      tipoAmortizacion: true,
      cliente: { select: { id: true, cedula: true, nombre: true, telefono: true } },
      eventos: {
        orderBy: [{ fechaProgramada: "asc" }, { numeroCuota: "asc" }],
        select: {
          numeroCuota: true,
          tipo: true,
          estado: true,
          fechaProgramada: true,
          valorProgramado: true,
          interesProgramado: true,
          capitalPagado: true,
          saldoCapitalPost: true,
        },
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  const sources: CreditFacetSource[] = authorized.map((credit) => ({
    id: credit.id,
    codigo: credit.codigo,
    estado: credit.estado,
    creadoEn: credit.creadoEn,
    fechaPrestamo: credit.fechaPrestamo,
    fechaCancelacion: credit.fechaCancelacion,
    monto: Number(credit.monto),
    plazoMeses: Number(credit.plazoMeses),
    tasaMensual: Number(credit.tasaMensual),
    frecuencia: credit.frecuencia,
    tipoAmortizacion: credit.tipoAmortizacion,
    cliente: credit.cliente,
    eventos: credit.eventos.map((event) => ({
      numeroCuota: event.numeroCuota,
      tipo: event.tipo,
      estado: event.estado,
      fechaProgramada: event.fechaProgramada,
      valorProgramado: Number(event.valorProgramado),
      interesProgramado: Number(event.interesProgramado),
      capitalPagado: Number(event.capitalPagado),
      saldoCapitalPost: event.saldoCapitalPost === null ? null : Number(event.saldoCapitalPost),
    })),
  }));

  const matching = sources.filter((credit) => matchesCreditFilters(credit, filters));
  const totalCoincidencias = matching.length;
  const totalPaginas = Math.max(1, Math.ceil(totalCoincidencias / CREDITOS_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPaginas);
  const pageSources = matching.slice((page - 1) * CREDITOS_PAGE_SIZE, page * CREDITOS_PAGE_SIZE);

  return {
    items: pageSources.map(toListItem),
    page,
    pageSize: CREDITOS_PAGE_SIZE,
    totalCoincidencias,
    totalPaginas,
    resumenSegmento: calcularResumenCreditos(matching, filters.segmento),
    resumenVisible: calcularResumenCreditos(pageSources, filters.segmento),
    facetas: buildCreditFacetCatalogs(sources, filters),
  };
}

function toListItem(credit: CreditFacetSource): CreditoListadoItem {
  const derived = derivarCreditoOperativo(credit);
  return {
    id: credit.id,
    codigo: credit.codigo,
    estado: credit.estado,
    fechaPrestamo: credit.fechaPrestamo,
    monto: credit.monto,
    plazoMeses: credit.plazoMeses,
    tasaMensual: credit.tasaMensual,
    frecuencia: credit.frecuencia as CreditoListadoItem["frecuencia"],
    tipoAmortizacion: credit.tipoAmortizacion as CreditoListadoItem["tipoAmortizacion"],
    cliente: credit.cliente,
    saldoCapital: derived.saldoCapital,
    interesPendiente: derived.interesPendiente,
    tieneCuotasVencidas: derived.tieneCuotasVencidas,
    proximaCuota: derived.proximaCuota,
  };
}
