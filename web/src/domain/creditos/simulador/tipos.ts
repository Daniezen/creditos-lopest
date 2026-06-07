/**
 * Tipos centrales del simulador de créditos.
 *
 * Este módulo define el contrato del motor financiero puro.
 * No importa React, Prisma ni APIs. La intención es que el cálculo pueda
 * probarse de forma aislada antes de conectarlo a una pantalla o a la base.
 */

export type FrecuenciaPago =
  | "Mensual"
  | "Quincenal 15/30"
  | "Quincenal 5/20"
  | "Quincenal 10/25";

export type TipoAmortizacion = "Amortización Fija" | "Solo Interés";

export type EstadoCuotaSimulada = "Pendiente" | "Atrasado";

export type TipoPagoSimulado = "CUOTA_PROGRAMADA";

/**
 * Entrada mínima necesaria para calcular un cronograma.
 *
 * Importante:
 * - `tasaMensual` debe llegar normalizada como decimal.
 *   Ejemplo: 20% => 0.2
 * - El saneamiento de entradas tipo "20%", "0,2" o "20" vive en otro módulo.
 */
export interface EntradaSimuladorCredito {
  idCredito?: string;
  cliente?: string;
  cedula?: string;

  fechaPrestamo: Date;
  monto: number;
  plazoMeses: number;
  tasaMensual: number;

  frecuencia: FrecuenciaPago;
  tipoAmortizacion: TipoAmortizacion;

  /**
   * Fecha contra la cual se calcula si una cuota simulada está vencida.
   * Si no se envía, el motor puede usar la fecha actual desde una capa superior,
   * pero los tests deben pasarla explícitamente para ser deterministas.
   */
  fechaReferencia?: Date;
}

/**
 * Salida atómica del cronograma.
 *
 * Estos nombres son cercanos al legado para facilitar comparación contra CSV,
 * pero están en camelCase para TypeScript.
 */
export interface CuotaSimulada {
  idCredito?: string;
  cliente?: string;
  cedula?: string;

  numeroCuota: number;
  tipoPago: TipoPagoSimulado;

  fechaProgramada: Date;

  valorCuota: number;
  capitalProgramado: number;
  interesProgramado: number;

  saldoCapitalPost: number;

  estado: EstadoCuotaSimulada;
  montoPagado: number;
}

/**
 * Resumen derivado del cronograma.
 *
 * No debe persistirse como fuente de verdad. Se calcula desde cuotas.
 */
export interface ResumenSimulacion {
  numeroCuotas: number;
  totalCapital: number;
  totalInteres: number;
  totalPagar: number;
  valorPromedioCuota: number;
  fechaPrimeraCuota: Date | null;
  fechaUltimaCuota: Date | null;
}