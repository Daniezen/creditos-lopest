export interface EventoElegibilidadReversion {
  id: string;
  tipo: string;
  estado: string;
  creadoEn: Date;
}

export function puedeRevertirAbonoRecalculando(input: {
  abonoId: string;
  abonoCreadoEn: Date;
  tipoAmortizacion: string;
  eventos: EventoElegibilidadReversion[];
}): boolean {
  if (input.tipoAmortizacion !== "SOLO_INTERES") return false;
  if (input.eventos.some((e) => e.tipo === "CUOTA_PROGRAMADA" && e.estado === "PAGADO")) return false;
  return !input.eventos.some(
    (e) => e.id !== input.abonoId && e.tipo === "ABONO_CAPITAL" && e.estado === "PAGADO" && e.creadoEn > input.abonoCreadoEn,
  );
}

export function recalcularSoloInteresTrasReversion(input: {
  saldoRestaurado: number;
  tasaMensual: number;
  frecuencia: string;
  cuotas: Array<{ id: string; numeroCuota: number | null }>;
}) {
  const cuotas = [...input.cuotas].sort((a, b) => Number(a.numeroCuota ?? 0) - Number(b.numeroCuota ?? 0));
  if (cuotas.length === 0) throw new Error("El crédito no tiene cuotas para recalcular.");
  const tasaPeriodo = input.frecuencia === "MENSUAL" ? input.tasaMensual : input.tasaMensual / 2;
  const interes = input.saldoRestaurado * tasaPeriodo;
  const ultimaId = cuotas.at(-1)?.id;
  return cuotas.map((cuota) => {
    const capital = cuota.id === ultimaId ? input.saldoRestaurado : 0;
    return {
      id: cuota.id,
      interesProgramado: interes,
      capitalProgramado: capital,
      valorProgramado: interes + capital,
      saldoCapitalPost: cuota.id === ultimaId ? 0 : input.saldoRestaurado,
    };
  });
}
