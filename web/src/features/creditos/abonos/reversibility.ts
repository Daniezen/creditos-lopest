import type { FinancialEventImage } from "./snapshot";
import { financialImageMatches } from "./snapshot";

interface CurrentFinancialEvent {
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

/** Returns true only when every installment affected by the abono is unchanged. */
export function isAbonoReversible(input: {
  eventosDespues: unknown;
  currentEvents: CurrentFinancialEvent[];
}): boolean {
  if (!Array.isArray(input.eventosDespues) || input.eventosDespues.length === 0) {
    return false;
  }

  const currentById = new Map(input.currentEvents.map((event) => [event.id, event]));
  return (input.eventosDespues as FinancialEventImage[]).every((expected) => {
    const current = currentById.get(expected.id);
    return current ? financialImageMatches(current, expected) : false;
  });
}
