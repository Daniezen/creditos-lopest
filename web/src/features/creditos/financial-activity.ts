export interface EventoConActividadFinanciera {
  tipo: string;
  estado: string;
  montoPagado: unknown;
  capitalPagado: unknown;
  interesPagado: unknown;
  fechaPago: Date | null;
}

/** Central rule used by every structural credit mutation. */
export function eventoTieneActividadFinanciera(
  evento: EventoConActividadFinanciera,
): boolean {
  return (
    evento.tipo === "ABONO_CAPITAL" ||
    evento.estado === "PAGADO" ||
    evento.estado === "CANCELADO_POR_ABONO" ||
    Number(evento.montoPagado) > 0 ||
    Number(evento.capitalPagado) > 0 ||
    Number(evento.interesPagado) > 0 ||
    evento.fechaPago !== null
  );
}
