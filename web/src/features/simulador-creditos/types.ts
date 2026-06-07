import type {
  CuotaSimulada,
  FrecuenciaPago,
  ResumenSimulacion,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";

/**
 * Estado del formulario visual del simulador.
 *
 * Los campos se mantienen como string porque vienen desde inputs HTML.
 * La normalización numérica ocurre en el hook antes de invocar el motor financiero.
 */
export interface SimulatorFormState {
  fechaPrestamo: string;
  monto: string;
  plazoMeses: string;
  tasaMensual: string;
  frecuencia: FrecuenciaPago | "";
  tipoAmortizacion: TipoAmortizacion | "";
}

export type SimulationStatus = "empty" | "success" | "error";

export interface SimulationResult {
  estado: SimulationStatus;
  cronograma: CuotaSimulada[];
  resumen: ResumenSimulacion | null;
  error: string | null;
}