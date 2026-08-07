/** Full calendar days granted after the scheduled date. */
export const DIAS_GRACIA_CUOTA = 1;

/**
 * Returns the exclusive cutoff used by the persistence query.
 *
 * With one grace day and `fechaProgramada < cutoff`, a quota scheduled for the
 * 15th remains pending on the 16th and becomes overdue on the 17th.
 */
export function obtenerCorteExclusivoCuotasVencidas(hoy: Date): Date {
  const corte = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  corte.setDate(corte.getDate() - DIAS_GRACIA_CUOTA);
  return corte;
}

/** Pure boundary predicate for tests and diagnostics. */
export function debeMarcarCuotaAtrasada(
  fechaProgramada: Date,
  hoy: Date,
): boolean {
  return fechaProgramada < obtenerCorteExclusivoCuotasVencidas(hoy);
}
