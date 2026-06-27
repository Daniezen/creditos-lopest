import {
  EstadoEventoFinanciero,
  FrecuenciaPago as PrismaFrecuenciaPago,
  TipoAmortizacion as PrismaTipoAmortizacion,
} from "@prisma/client";

import type {
  EstadoCuotaSimulada,
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";

import {
  parseDateInputValue,
  parseNumericInput,
  parseTasaMensualInput,
} from "@/lib/formatters";

import type { SimulatorFormState } from "@/features/simulador-creditos/types";

export interface CondicionesCreditoNormalizadas {
  fechaPrestamo: Date;
  monto: number;
  plazoMeses: number;
  tasaMensual: number;
  frecuencia: FrecuenciaPago;
  tipoAmortizacion: TipoAmortizacion;
}

/**
 * Normaliza y valida los datos del formulario visual.
 *
 * El navegador solo es fuente de entrada, no de verdad financiera.
 * El servidor valida y luego recalcula el cronograma.
 */
export function normalizarCondicionesCredito(
  form: SimulatorFormState,
): CondicionesCreditoNormalizadas {
  if (!form.fechaPrestamo.trim()) {
    throw new Error("La fecha del préstamo es obligatoria.");
  }

  if (!form.monto.trim()) {
    throw new Error("El valor del préstamo es obligatorio.");
  }

  if (!form.plazoMeses.trim()) {
    throw new Error("El plazo es obligatorio.");
  }

  if (!form.tasaMensual.trim()) {
    throw new Error("La tasa mensual es obligatoria.");
  }

  if (!isFrecuenciaPago(form.frecuencia)) {
    throw new Error("La frecuencia de pago no es válida.");
  }

  if (!isTipoAmortizacion(form.tipoAmortizacion)) {
    throw new Error("El tipo de crédito no es válido.");
  }

  const fechaPrestamo = parseDateInputValue(form.fechaPrestamo);
  const monto = parseNumericInput(form.monto);
  const plazoMeses = parseNumericInput(form.plazoMeses);
  const tasaMensual = parseTasaMensualInput(form.tasaMensual);

  if (Number.isNaN(fechaPrestamo.getTime())) {
    throw new Error("La fecha del préstamo no es válida.");
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("El valor del préstamo debe ser mayor a cero.");
  }

  if (!Number.isFinite(plazoMeses) || plazoMeses <= 0) {
    throw new Error("El plazo debe ser mayor a cero.");
  }

  if (!Number.isFinite(tasaMensual) || tasaMensual <= 0) {
    throw new Error("La tasa mensual debe ser mayor a cero.");
  }

  return {
    fechaPrestamo,
    monto,
    plazoMeses,
    tasaMensual,
    frecuencia: form.frecuencia,
    tipoAmortizacion: form.tipoAmortizacion,
  };
}

export function mapFrecuenciaPagoToPrisma(
  frecuencia: FrecuenciaPago,
): PrismaFrecuenciaPago {
  if (frecuencia === "Mensual") {
    return PrismaFrecuenciaPago.MENSUAL;
  }

  if (frecuencia === "Quincenal 5/20") {
    return PrismaFrecuenciaPago.QUINCENAL_5_20;
  }

  if (frecuencia === "Quincenal 10/25") {
    return PrismaFrecuenciaPago.QUINCENAL_10_25;
  }

  return PrismaFrecuenciaPago.QUINCENAL_15_30;
}

export function mapTipoAmortizacionToPrisma(
  tipo: TipoAmortizacion,
): PrismaTipoAmortizacion {
  if (tipo === "Solo Interés") {
    return PrismaTipoAmortizacion.SOLO_INTERES;
  }

  return PrismaTipoAmortizacion.AMORTIZACION_FIJA;
}

export function mapEstadoCuotaToPrisma(
  estado: EstadoCuotaSimulada,
): EstadoEventoFinanciero {
  if (estado === "Atrasado") {
    return EstadoEventoFinanciero.ATRASADO;
  }

  return EstadoEventoFinanciero.PENDIENTE;
}

export function toMoneyDecimalString(value: number): string {
  return value.toFixed(2);
}

export function toRateDecimalString(value: number): string {
  return value.toFixed(6);
}

export function toTermDecimalString(value: number): string {
  return value.toFixed(2);
}

function isFrecuenciaPago(value: string): value is FrecuenciaPago {
  return (
    value === "Mensual" ||
    value === "Quincenal 15/30" ||
    value === "Quincenal 5/20" ||
    value === "Quincenal 10/25"
  );
}

function isTipoAmortizacion(value: string): value is TipoAmortizacion {
  return value === "Amortización Fija" || value === "Solo Interés";
}
