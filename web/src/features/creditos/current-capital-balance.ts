export interface EventoCapitalRealizado {
  estado: string;
  capitalPagado?: unknown;
  saldoCapitalPost?: unknown | null;
}

/** Derives current principal from realized ledger movements only. */
export function calcularSaldoCapitalActual(
  montoOriginal: unknown,
  eventos: EventoCapitalRealizado[],
): number {
  const monto = normalizarDineroNoNegativo(montoOriginal);
  const saldosRealizados = eventos
    .filter((evento) => evento.estado === "PAGADO")
    .map((evento) => evento.saldoCapitalPost)
    .filter((saldo): saldo is NonNullable<typeof saldo> => saldo !== null && saldo !== undefined)
    .map(normalizarDineroNoNegativo);

  if (saldosRealizados.length > 0) {
    // Supported payments and prepayments only reduce principal. Taking the
    // minimum removes ordering ambiguity when several payments share a date.
    return Math.min(monto, ...saldosRealizados);
  }

  // Fallback only for records without historical post-balance snapshots.
  const capitalPagado = eventos.reduce((total, evento) => {
    if (evento.estado !== "PAGADO") return total;
    return total + normalizarDineroNoNegativo(evento.capitalPagado);
  }, 0);
  return Math.max(0, monto - capitalPagado);
}

function normalizarDineroNoNegativo(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
