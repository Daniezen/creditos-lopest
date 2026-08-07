/** Resolves the balance displayed for one financial movement. */
export function resolverSaldoMostradoMovimiento(input: {
  estado: string;
  saldoCapitalPost: unknown | null;
  saldoRealizado: number | null;
}): number | null {
  if (input.estado === "CANCELADO_POR_ABONO") return null;
  if (input.estado === "PAGADO") return input.saldoRealizado;
  return input.saldoCapitalPost === null ? null : Number(input.saldoCapitalPost);
}
