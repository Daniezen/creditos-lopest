import type {
  EstadoCredito,
  EstadoEventoFinanciero,
  FrecuenciaPago,
  TipoAmortizacion,
  TipoEventoFinanciero,
} from "@prisma/client";

import {
  derivarCreditoOperativo,
  type CuotaResumenCredito,
} from "../creditos/portfolio-summary";

export interface ClientDetailCreditSource {
  id: string;
  codigo: string;
  estado: EstadoCredito;
  fechaPrestamo: Date;
  fechaCancelacion: Date | null;
  monto: unknown;
  plazoMeses: unknown;
  tasaMensual: unknown;
  frecuencia: FrecuenciaPago;
  tipoAmortizacion: TipoAmortizacion;
  eventos: Array<{
    numeroCuota: number | null;
    tipo: TipoEventoFinanciero;
    estado: EstadoEventoFinanciero;
    fechaProgramada: Date;
    valorProgramado: unknown;
    interesProgramado: unknown;
    capitalPagado?: unknown;
    saldoCapitalPost: unknown | null;
  }>;
}

export interface ClientDetailCreditItem {
  id: string;
  codigo: string;
  estado: EstadoCredito;
  fechaPrestamo: Date;
  monto: number;
  saldoCapital: number;
  interesPendiente: number;
  tieneCuotasVencidas: boolean;
  proximaCuota: CuotaResumenCredito | null;
  cuotaVencidaMasAntigua: CuotaResumenCredito | null;
}

export interface ClientDetailPortfolio {
  items: ClientDetailCreditItem[];
  creditosActivos: number;
  capitalPendiente: number;
  interesPendiente: number;
  creditosConCuotasVencidas: number;
}

/** Uses the canonical Credit ledger derivation for the client detail view. */
export function deriveClientDetailPortfolio(
  credits: ClientDetailCreditSource[],
): ClientDetailPortfolio {
  const items = credits.map((credit) => {
    const operational = derivarCreditoOperativo({
      id: credit.id,
      codigo: credit.codigo,
      estado: credit.estado,
      monto: Number(credit.monto),
      fechaCancelacion: credit.fechaCancelacion,
      eventos: credit.eventos.map((event) => ({
        numeroCuota: event.numeroCuota,
        tipo: event.tipo,
        estado: event.estado,
        fechaProgramada: event.fechaProgramada,
        valorProgramado: Number(event.valorProgramado),
        interesProgramado: Number(event.interesProgramado),
        capitalPagado:
          event.capitalPagado === undefined
            ? undefined
            : Number(event.capitalPagado),
        saldoCapitalPost:
          event.saldoCapitalPost === null ? null : Number(event.saldoCapitalPost),
      })),
    });

    return {
      id: credit.id,
      codigo: credit.codigo,
      estado: credit.estado,
      fechaPrestamo: credit.fechaPrestamo,
      monto: Number(credit.monto),
      saldoCapital: operational.saldoCapital,
      interesPendiente: operational.interesPendiente,
      tieneCuotasVencidas: operational.tieneCuotasVencidas,
      proximaCuota: operational.proximaCuota,
      cuotaVencidaMasAntigua: operational.cuotaVencidaMasAntigua,
    };
  });

  const active = items.filter((credit) => credit.estado === "ACTIVO");
  return {
    items,
    creditosActivos: active.length,
    capitalPendiente: active.reduce((total, credit) => total + credit.saldoCapital, 0),
    interesPendiente: active.reduce((total, credit) => total + credit.interesPendiente, 0),
    creditosConCuotasVencidas: active.filter((credit) => credit.tieneCuotasVencidas).length,
  };
}
