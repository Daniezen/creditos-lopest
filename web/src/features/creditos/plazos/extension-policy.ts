export interface OperationalInstallment {
  id: string;
  numeroCuota: number | null;
  estado: string;
}

export function isOperationalUnpaidState(state: string): boolean {
  return state === "PENDIENTE" || state === "ATRASADO" || state === "MORA";
}

/** Recalculates money only. Dates, numbers and operational states remain immutable. */
export function recalcularCuotasSoloInteres(input: {
  saldoCapital: number;
  tasaMensual: number;
  frecuencia: string;
  cuotas: OperationalInstallment[];
}) {
  const cuotas = [...input.cuotas]
    .filter((cuota) => isOperationalUnpaidState(cuota.estado))
    .sort((a, b) => Number(a.numeroCuota ?? 0) - Number(b.numeroCuota ?? 0));
  if (cuotas.length === 0) throw new Error("El crédito no tiene cuotas pendientes para extender.");
  if (!(input.saldoCapital > 0)) throw new Error("El crédito no tiene capital pendiente para extender.");
  const tasaPeriodo = input.frecuencia === "MENSUAL" ? input.tasaMensual : input.tasaMensual / 2;
  const interes = input.saldoCapital * tasaPeriodo;
  return cuotas.map((cuota) => ({
    id: cuota.id,
    numeroCuota: cuota.numeroCuota,
    interesProgramado: interes,
    capitalProgramado: 0,
    valorProgramado: interes,
    saldoCapitalPost: input.saldoCapital,
  }));
}

export function incrementoPlazoMeses(cuotasExtra: number, frecuencia: string): number {
  return frecuencia === "MENSUAL" ? cuotasExtra : cuotasExtra / 2;
}
