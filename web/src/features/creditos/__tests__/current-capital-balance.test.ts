import { describe, expect, it } from "vitest";
import { calcularSaldoCapitalActual } from "../current-capital-balance";

describe("calcularSaldoCapitalActual", () => {
  it("elige el menor saldo realizado cuando varios pagos comparten fecha", () => {
    expect(calcularSaldoCapitalActual(700_000, [
      { estado: "PAGADO", capitalPagado: 0, saldoCapitalPost: 650_000 },
      { estado: "PAGADO", capitalPagado: 0, saldoCapitalPost: 600_000 },
      { estado: "PAGADO", capitalPagado: 0, saldoCapitalPost: 550_000 },
      { estado: "PAGADO", capitalPagado: 0, saldoCapitalPost: 500_000 },
      { estado: "PAGADO", capitalPagado: 50_000, saldoCapitalPost: 450_000 },
      { estado: "PAGADO", capitalPagado: 50_000, saldoCapitalPost: 400_000 },
    ])).toBe(400_000);
  });
  it("incluye abonos extraordinarios", () => {
    expect(calcularSaldoCapitalActual(500_000, [
      { estado: "PAGADO", capitalPagado: 62_500, saldoCapitalPost: 437_500 },
      { estado: "PAGADO", capitalPagado: 62_500, saldoCapitalPost: 375_000 },
      { estado: "PAGADO", capitalPagado: 62_500, saldoCapitalPost: 312_500 },
      { estado: "PAGADO", capitalPagado: 312_500, saldoCapitalPost: 0 },
    ])).toBe(0);
  });
  it("ignora eventos no pagados y limita el saldo a cero", () => {
    expect(calcularSaldoCapitalActual(100_000, [
      { estado: "PENDIENTE", capitalPagado: 90_000 },
      { estado: "CANCELADO_POR_ABONO", capitalPagado: 90_000 },
      { estado: "PAGADO", capitalPagado: 120_000 },
    ])).toBe(0);
  });
});
