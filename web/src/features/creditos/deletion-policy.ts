import { eventoTieneActividadFinanciera, type EventoConActividadFinanciera } from "./financial-activity";

/** A credit may be hidden only when no realized financial fact remains active. */
export function puedeBorrarseCredito(eventos: EventoConActividadFinanciera[]): boolean {
  return !eventos.some(eventoTieneActividadFinanciera);
}

export function esPosibleDuplicado(input: {
  fechaPrestamo: Date;
  tasaMensual: number;
  frecuencia: string;
  tipoAmortizacion: string;
  monto: number;
}, existente: {
  fechaPrestamo: Date;
  tasaMensual: unknown;
  frecuencia: string;
  tipoAmortizacion: string;
  monto: unknown;
}): boolean {
  const mismoDia = input.fechaPrestamo.toISOString().slice(0, 10) === existente.fechaPrestamo.toISOString().slice(0, 10);
  const mismaTasa = Math.abs(input.tasaMensual - Number(existente.tasaMensual)) < 0.000001;
  const mismoContrato = input.frecuencia === existente.frecuencia && input.tipoAmortizacion === existente.tipoAmortizacion;
  const mayorMonto = Math.max(input.monto, Number(existente.monto));
  const diferenciaRelativa = mayorMonto > 0 ? Math.abs(input.monto - Number(existente.monto)) / mayorMonto : 1;
  return mismoDia && mismaTasa && mismoContrato && diferenciaRelativa <= 0.25;
}
