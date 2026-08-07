import { describe, expect, it } from "vitest";
import { resolverSaldoMostradoMovimiento } from "../movement-balance-display";

describe("resolverSaldoMostradoMovimiento", () => {
  it("oculta saldo en cuotas canceladas por abono", () => {
    expect(resolverSaldoMostradoMovimiento({ estado: "CANCELADO_POR_ABONO", saldoCapitalPost: 125_000, saldoRealizado: null })).toBeNull();
  });
  it("usa saldo realizado en movimientos pagados", () => {
    expect(resolverSaldoMostradoMovimiento({ estado: "PAGADO", saldoCapitalPost: 450_000, saldoRealizado: 400_000 })).toBe(400_000);
  });
  it("mantiene proyección para cuotas futuras", () => {
    expect(resolverSaldoMostradoMovimiento({ estado: "PENDIENTE", saldoCapitalPost: 300_000, saldoRealizado: null })).toBe(300_000);
  });
});
