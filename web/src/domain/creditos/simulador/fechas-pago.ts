import type { FrecuenciaPago } from "./tipos";

/**
 * Normaliza una fecha eliminando hora, minutos, segundos y milisegundos.
 *
 * Motivo:
 * JavaScript Date contiene hora. Si comparas fechas con horas distintas,
 * puedes marcar cuotas como vencidas por error. Este helper fuerza comparación
 * a nivel de día calendario local.
 */
export function normalizarFechaSinHora(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Calcula días inclusivos entre dos fechas.
 *
 * Es una migración directa de la lógica Apps Script:
 * diferencia en días + 1.
 *
 * Ejemplo:
 * inicio 2026-03-01, fin 2026-03-01 => 1 día inclusivo.
 */
export function calcularDiasInclusivos(fechaInicio: Date, fechaFin: Date): number {
  const inicio = normalizarFechaSinHora(fechaInicio);
  const fin = normalizarFechaSinHora(fechaFin);

  const milisegundosPorDia = 1000 * 60 * 60 * 24;
  const diferenciaMilisegundos = fin.getTime() - inicio.getTime();

  return Math.floor(diferenciaMilisegundos / milisegundosPorDia) + 1;
}

/**
 * Devuelve el último día del mes de la fecha dada.
 *
 * Este comportamiento es clave para la frecuencia mensual y para el calendario
 * quincenal 15/30, donde "30" realmente significa "fin de mes".
 */
export function obtenerFinDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
}

/**
 * Busca la siguiente fecha de pago quincenal según calendario.
 *
 * Reglas heredadas de Apps Script:
 *
 * - Quincenal 5/20:
 *   dia < 5       => día 5 del mismo mes
 *   5 <= dia < 20 => día 20 del mismo mes
 *   dia >= 20     => día 5 del mes siguiente
 *
 * - Quincenal 10/25:
 *   dia < 10       => día 10 del mismo mes
 *   10 <= dia < 25 => día 25 del mismo mes
 *   dia >= 25      => día 10 del mes siguiente
 *
 * - Quincenal 15/30:
 *   dia < 15          => día 15 del mismo mes
 *   15 <= dia < fin   => fin de mes
 *   dia >= fin        => día 15 del mes siguiente
 */
export function buscarSiguienteQuincena(
  fecha: Date,
  frecuencia: Extract<FrecuenciaPago, "Quincenal 15/30" | "Quincenal 5/20" | "Quincenal 10/25">,
): Date {
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth();
  const dia = fecha.getDate();

  if (frecuencia === "Quincenal 5/20") {
    if (dia < 5) return new Date(anio, mes, 5);
    if (dia >= 5 && dia < 20) return new Date(anio, mes, 20);
    return new Date(anio, mes + 1, 5);
  }

  if (frecuencia === "Quincenal 10/25") {
    if (dia < 10) return new Date(anio, mes, 10);
    if (dia >= 10 && dia < 25) return new Date(anio, mes, 25);
    return new Date(anio, mes + 1, 10);
  }

  const finDeMes = obtenerFinDeMes(fecha);
  const diaFinMes = finDeMes.getDate();

  if (dia < 15) return new Date(anio, mes, 15);
  if (dia >= 15 && dia < diaFinMes) return finDeMes;

  return new Date(anio, mes + 1, 15);
}

/**
 * Calcula el estado proyectado de una cuota simulada.
 *
 * Esto reemplaza el uso oculto de `new Date()` dentro del motor financiero.
 * Para tests, se debe pasar una fechaReferencia fija.
 */
export function calcularEstadoPorFecha(
  fechaProgramada: Date,
  fechaReferencia: Date,
): "Pendiente" | "Atrasado" {
  const fechaCuota = normalizarFechaSinHora(fechaProgramada);
  const referencia = normalizarFechaSinHora(fechaReferencia);

  return fechaCuota.getTime() < referencia.getTime() ? "Atrasado" : "Pendiente";
}