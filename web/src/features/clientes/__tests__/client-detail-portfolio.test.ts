import { describe, expect, it } from "vitest";

import { deriveClientDetailPortfolio, type ClientDetailCreditSource } from "../client-detail-portfolio";

function credit(events: ClientDetailCreditSource["eventos"]): ClientDetailCreditSource {
  return {
    id: "credit-1",
    codigo: "LP-1",
    estado: "ACTIVO",
    fechaPrestamo: new Date("2026-06-01T12:00:00"),
    fechaCancelacion: null,
    monto: 200_000,
    plazoMeses: 4,
    tasaMensual: 0.1,
    frecuencia: "MENSUAL",
    tipoAmortizacion: "AMORTIZACION_FIJA",
    eventos: events,
  };
}

function installment(
  estado: "PENDIENTE" | "ATRASADO" | "PAGADO",
  date: string,
  balance: number | null,
) {
  return {
    numeroCuota: 1,
    tipo: "CUOTA_PROGRAMADA" as const,
    estado,
    fechaProgramada: new Date(`${date}T12:00:00`),
    valorProgramado: 60_000,
    interesProgramado: 10_000,
    saldoCapitalPost: balance,
  };
}

describe("cartera del detalle del cliente", () => {
  it("usa saldo realizado y separa próxima cuota de cuota vencida", () => {
    const result = deriveClientDetailPortfolio([
      credit([
        installment("PAGADO", "2026-06-30", 150_000),
        installment("ATRASADO", "2026-07-15", 100_000),
        installment("PENDIENTE", "2026-08-15", 50_000),
      ]),
    ]);

    expect(result.capitalPendiente).toBe(150_000);
    expect(result.interesPendiente).toBe(20_000);
    expect(result.creditosConCuotasVencidas).toBe(1);
    expect(result.items[0].cuotaVencidaMasAntigua?.fechaProgramada.toISOString()).toContain("2026-07-15");
    expect(result.items[0].proximaCuota?.fechaProgramada.toISOString()).toContain("2026-08-15");
  });
});
