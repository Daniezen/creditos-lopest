import type { CuotaSimulada, ResumenSimulacion } from "./tipos";

/**
 * Construye un resumen financiero a partir del cronograma simulado.
 *
 * Este resumen es derivado. No debe tratarse como fuente de verdad.
 * La fuente de verdad son las cuotas/eventos.
 */
export function resumirCronograma(
  cuotas: CuotaSimulada[],
): ResumenSimulacion {
  if (cuotas.length === 0) {
    return {
      numeroCuotas: 0,
      totalCapital: 0,
      totalInteres: 0,
      totalPagar: 0,
      valorPromedioCuota: 0,
      fechaPrimeraCuota: null,
      fechaUltimaCuota: null,
    };
  }

  const totalCapital = cuotas.reduce(
    (acumulado, cuota) => acumulado + cuota.capitalProgramado,
    0,
  );

  const totalInteres = cuotas.reduce(
    (acumulado, cuota) => acumulado + cuota.interesProgramado,
    0,
  );

  const totalPagar = cuotas.reduce(
    (acumulado, cuota) => acumulado + cuota.valorCuota,
    0,
  );

  const cuotasOrdenadas = [...cuotas].sort(
    (a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime(),
  );

  return {
    numeroCuotas: cuotas.length,
    totalCapital,
    totalInteres,
    totalPagar,
    valorPromedioCuota: totalPagar / cuotas.length,
    fechaPrimeraCuota: cuotasOrdenadas[0]?.fechaProgramada ?? null,
    fechaUltimaCuota:
      cuotasOrdenadas[cuotasOrdenadas.length - 1]?.fechaProgramada ?? null,
  };
}