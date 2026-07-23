import type { Prisma } from "@prisma/client";

export interface FinancialEventImage {
  id: string;
  fechaProgramada: string;
  fechaPago: string | null;
  valorProgramado: string;
  capitalProgramado: string;
  interesProgramado: string;
  montoPagado: string;
  capitalPagado: string;
  interesPagado: string;
  saldoCapitalPost: string | null;
  estado: string;
  diasAtraso: number;
  accionPor: string | null;
}

interface SnapshotSourceEvent {
  id: string;
  fechaProgramada: Date;
  fechaPago: Date | null;
  valorProgramado: unknown;
  capitalProgramado: unknown;
  interesProgramado: unknown;
  montoPagado: unknown;
  capitalPagado: unknown;
  interesPagado: unknown;
  saldoCapitalPost: unknown | null;
  estado: string;
  diasAtraso: number;
  accionPor: string | null;
}

/** Captures only fields whose divergence can make an abono unsafe to reverse. */
export function toFinancialEventImage(
  evento: SnapshotSourceEvent,
): FinancialEventImage {
  return {
    id: evento.id,
    fechaProgramada: evento.fechaProgramada.toISOString(),
    fechaPago: evento.fechaPago?.toISOString() ?? null,
    valorProgramado: normalizeMoney(evento.valorProgramado),
    capitalProgramado: normalizeMoney(evento.capitalProgramado),
    interesProgramado: normalizeMoney(evento.interesProgramado),
    montoPagado: normalizeMoney(evento.montoPagado),
    capitalPagado: normalizeMoney(evento.capitalPagado),
    interesPagado: normalizeMoney(evento.interesPagado),
    saldoCapitalPost:
      evento.saldoCapitalPost === null ? null : normalizeMoney(evento.saldoCapitalPost),
    estado: evento.estado,
    diasAtraso: evento.diasAtraso,
    accionPor: evento.accionPor,
  };
}

export function financialImageChanged(
  before: FinancialEventImage,
  after: FinancialEventImage,
): boolean {
  return financialComparable(before) !== financialComparable(after);
}

/**
 * Technical metadata is intentionally excluded. Only financial and operational
 * fields determine whether an affected installment diverged after the abono.
 */
export function financialImageMatches(
  current: SnapshotSourceEvent,
  expected: FinancialEventImage,
): boolean {
  return financialComparable(toFinancialEventImage(current)) === financialComparable(expected);
}

export function toSnapshotJson(
  images: FinancialEventImage[],
): Prisma.InputJsonArray {
  return images as unknown as Prisma.InputJsonArray;
}

function financialComparable(image: FinancialEventImage): string {
  return JSON.stringify({
    fechaProgramada: image.fechaProgramada,
    fechaPago: image.fechaPago,
    valorProgramado: image.valorProgramado,
    capitalProgramado: image.capitalProgramado,
    interesProgramado: image.interesProgramado,
    montoPagado: image.montoPagado,
    capitalPagado: image.capitalPagado,
    interesPagado: image.interesPagado,
    saldoCapitalPost: image.saldoCapitalPost,
    estado: image.estado,
    diasAtraso: image.diasAtraso,
  });
}


/** Normalizes Prisma Decimal and JSON monetary values to a stable comparison form. */
function normalizeMoney(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("El snapshot contiene un valor monetario no numerico.");
  }
  return parsed.toFixed(2);
}
