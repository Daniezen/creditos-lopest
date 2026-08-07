import type {
  EstadoCredito,
  EstadoEventoFinanciero,
  TipoEventoFinanciero,
} from "@prisma/client";

import { calcularSaldoCapitalActual } from "./current-capital-balance";

export type SegmentoCreditos = "TODOS" | "ACTIVO" | "VENCIDA" | "CANCELADO";

export interface EventoResumenCredito {
  numeroCuota: number | null;
  tipo: TipoEventoFinanciero;
  estado: EstadoEventoFinanciero;
  fechaProgramada: Date;
  valorProgramado: number;
  interesProgramado: number;
  capitalPagado?: number;
  saldoCapitalPost: number | null;
}

export interface CreditoResumenFuente {
  id: string;
  codigo: string;
  estado: EstadoCredito;
  monto: number;
  fechaCancelacion: Date | null;
  eventos: EventoResumenCredito[];
}

export interface CuotaResumenCredito {
  creditoId: string;
  codigoCredito: string;
  numeroCuota: number | null;
  fechaProgramada: Date;
  valorProgramado: number;
  estado: EstadoEventoFinanciero;
}

export interface CreditoOperativoDerivado {
  saldoCapital: number;
  interesPendiente: number;
  tieneCuotasVencidas: boolean;
  proximaCuota: CuotaResumenCredito | null;
  cuotaVencidaMasAntigua: CuotaResumenCredito | null;
}

export interface ResumenCreditos {
  segmento: SegmentoCreditos;
  totalCreditos: number;
  creditosVigentes: number;
  creditosConCuotasVencidas: number;
  creditosCancelados: number;
  montoOriginal: number;
  capitalPendiente: number;
  interesPendiente: number;
  proximaCuota: CuotaResumenCredito | null;
  cuotaVencidaMasAntigua: CuotaResumenCredito | null;
  ultimaCancelacion: Date | null;
}

/** Derives ledger-backed values for one credit without using a paginated view. */
export function derivarCreditoOperativo(
  credito: CreditoResumenFuente,
): CreditoOperativoDerivado {
  const cuotasOperativas = credito.estado === "ACTIVO"
    ? credito.eventos.filter(
        (evento) =>
          evento.tipo === "CUOTA_PROGRAMADA" &&
          isPendingState(evento.estado),
      )
    : [];

  const saldoCapital = credito.estado === "ACTIVO"
    ? calcularSaldoCapitalActual(credito.monto, credito.eventos)
    : 0;
  const interesPendiente = cuotasOperativas.reduce(
    (total, evento) => total + sanitizePositiveMoney(evento.interesProgramado),
    0,
  );
  const cuotasPendientes = cuotasOperativas.filter(
    (evento) => evento.estado === "PENDIENTE",
  );
  const cuotasVencidas = cuotasOperativas.filter(
    (evento) => evento.estado === "ATRASADO" || evento.estado === "MORA",
  );

  return {
    saldoCapital,
    interesPendiente,
    tieneCuotasVencidas: cuotasVencidas.length > 0,
    proximaCuota: toCuotaResumen(credito, cuotasPendientes[0] ?? null),
    cuotaVencidaMasAntigua: toCuotaResumen(credito, cuotasVencidas[0] ?? null),
  };
}

/**
 * Calculates cards and totals over the complete filtered segment. The caller is
 * responsible for passing every authorized match, never only the current page.
 */
export function calcularResumenCreditos(
  creditos: CreditoResumenFuente[],
  segmento: SegmentoCreditos,
): ResumenCreditos {
  const derivados = creditos.map((credito) => ({
    credito,
    operativo: derivarCreditoOperativo(credito),
  }));
  const vigentes = derivados.filter(({ credito }) => credito.estado === "ACTIVO");
  const vencidos = vigentes.filter(({ operativo }) => operativo.tieneCuotasVencidas);
  const cancelados = derivados.filter(({ credito }) => credito.estado === "CANCELADO");
  const operationalScope = segmento === "CANCELADO"
    ? cancelados
    : segmento === "VENCIDA"
      ? vencidos
      : vigentes;
  const originalAmountScope = segmento === "TODOS" ? derivados : operationalScope;

  const operationalInstallments = operationalScope
    .map(({ operativo }) => operativo.proximaCuota)
    .filter((cuota): cuota is CuotaResumenCredito => cuota !== null)
    .sort(compareInstallments);
  const overdueInstallments = operationalScope
    .map(({ operativo }) => operativo.cuotaVencidaMasAntigua)
    .filter((cuota): cuota is CuotaResumenCredito => cuota !== null)
    .sort(compareInstallments);
  const cancellationDates = cancelados
    .map(({ credito }) => credito.fechaCancelacion)
    .filter((date): date is Date => date !== null)
    .sort((left, right) => right.getTime() - left.getTime());

  return {
    segmento,
    totalCreditos: creditos.length,
    creditosVigentes: vigentes.length,
    creditosConCuotasVencidas: vencidos.length,
    creditosCancelados: cancelados.length,
    montoOriginal: originalAmountScope.reduce(
      (total, { credito }) => total + sanitizeMoney(credito.monto),
      0,
    ),
    capitalPendiente: operationalScope.reduce(
      (total, { operativo }) => total + operativo.saldoCapital,
      0,
    ),
    interesPendiente: operationalScope.reduce(
      (total, { operativo }) => total + operativo.interesPendiente,
      0,
    ),
    proximaCuota: operationalInstallments[0] ?? null,
    cuotaVencidaMasAntigua: overdueInstallments[0] ?? null,
    ultimaCancelacion: cancellationDates[0] ?? null,
  };
}

function isPendingState(estado: EstadoEventoFinanciero): boolean {
  return estado === "PENDIENTE" || estado === "ATRASADO" || estado === "MORA";
}

function toCuotaResumen(
  credito: CreditoResumenFuente,
  evento: EventoResumenCredito | null,
): CuotaResumenCredito | null {
  if (!evento) return null;
  return {
    creditoId: credito.id,
    codigoCredito: credito.codigo,
    numeroCuota: evento.numeroCuota,
    fechaProgramada: evento.fechaProgramada,
    valorProgramado: sanitizeMoney(evento.valorProgramado),
    estado: evento.estado,
  };
}

function compareInstallments(
  left: CuotaResumenCredito,
  right: CuotaResumenCredito,
): number {
  return left.fechaProgramada.getTime() - right.fechaProgramada.getTime();
}

function sanitizeMoney(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sanitizePositiveMoney(value: unknown): number {
  return sanitizeMoney(value);
}
