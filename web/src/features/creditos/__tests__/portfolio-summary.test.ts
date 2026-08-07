import { describe, expect, it } from "vitest";

import {
  calcularResumenCreditos,
  derivarCreditoOperativo,
  type CreditoResumenFuente,
} from "../portfolio-summary";

function credit(
  overrides: Partial<CreditoResumenFuente> & Pick<CreditoResumenFuente, "id" | "codigo">,
): CreditoResumenFuente {
  return {
    id: overrides.id,
    codigo: overrides.codigo,
    estado: overrides.estado ?? "ACTIVO",
    monto: overrides.monto ?? 100_000,
    fechaCancelacion: overrides.fechaCancelacion ?? null,
    eventos: overrides.eventos ?? [],
  };
}

function installment(
  state: "PENDIENTE" | "ATRASADO" | "MORA" | "PAGADO" | "CANCELADO_POR_ABONO",
  date: string,
  interest: number,
  balance: number | null = null,
) {
  return {
    numeroCuota: 1,
    tipo: "CUOTA_PROGRAMADA" as const,
    estado: state,
    fechaProgramada: new Date(`${date}T12:00:00`),
    valorProgramado: 20_000,
    interesProgramado: interest,
    saldoCapitalPost: balance,
  };
}

describe("resumen operativo de créditos", () => {
  it("suma interés pendiente solo de cuotas operativas de créditos activos", () => {
    const active = credit({
      id: "a",
      codigo: "A",
      eventos: [
        installment("PENDIENTE", "2026-08-20", 10_000),
        installment("ATRASADO", "2026-07-20", 8_000),
        installment("PAGADO", "2026-06-20", 7_000, 80_000),
        installment("CANCELADO_POR_ABONO", "2026-09-20", 6_000),
      ],
    });
    const cancelled = credit({
      id: "c",
      codigo: "C",
      estado: "CANCELADO",
      eventos: [installment("PENDIENTE", "2026-08-20", 99_000)],
    });

    const result = calcularResumenCreditos([active, cancelled], "TODOS");

    expect(result.interesPendiente).toBe(18_000);
    expect(result.capitalPendiente).toBe(80_000);
    expect(result.creditosVigentes).toBe(1);
  });

  it("deriva vencimiento y conserva la identidad del crédito en la cuota", () => {
    const source = credit({
      id: "overdue",
      codigo: "LP-1",
      eventos: [
        installment("ATRASADO", "2026-06-20", 5_000),
        installment("PENDIENTE", "2026-08-20", 5_000),
      ],
    });

    const result = derivarCreditoOperativo(source);

    expect(result.tieneCuotasVencidas).toBe(true);
    expect(result.cuotaVencidaMasAntigua?.creditoId).toBe("overdue");
    expect(result.cuotaVencidaMasAntigua?.codigoCredito).toBe("LP-1");
  });

  it("resume el segmento vencido con exposición total y cuota más antigua", () => {
    const overdue = credit({
      id: "o",
      codigo: "O",
      monto: 200_000,
      eventos: [
        installment("PAGADO", "2026-05-20", 1_000, 150_000),
        installment("ATRASADO", "2026-06-20", 9_000),
      ],
    });
    const current = credit({
      id: "p",
      codigo: "P",
      eventos: [installment("PENDIENTE", "2026-09-20", 4_000)],
    });

    const result = calcularResumenCreditos([overdue, current], "VENCIDA");

    expect(result.creditosConCuotasVencidas).toBe(1);
    expect(result.capitalPendiente).toBe(150_000);
    expect(result.interesPendiente).toBe(9_000);
    expect(result.cuotaVencidaMasAntigua?.creditoId).toBe("o");
  });

  it("resume cancelados sin capital ni interés pendiente", () => {
    const cancelled = credit({
      id: "c",
      codigo: "C",
      estado: "CANCELADO",
      monto: 300_000,
      fechaCancelacion: new Date("2026-07-01T12:00:00"),
      eventos: [installment("PAGADO", "2026-06-20", 20_000, 0)],
    });

    const result = calcularResumenCreditos([cancelled], "CANCELADO");

    expect(result.montoOriginal).toBe(300_000);
    expect(result.creditosCancelados).toBe(1);
    expect(result.capitalPendiente).toBe(0);
    expect(result.interesPendiente).toBe(0);
    expect(result.ultimaCancelacion?.toISOString()).toContain("2026-07-01");
  });
  it("diferencia Todos de Activos y excluye cuotas vencidas de la próxima cuota", () => {
    const active = credit({
      id: "a",
      codigo: "A",
      monto: 100_000,
      eventos: [
        installment("ATRASADO", "2026-06-20", 8_000),
        installment("PENDIENTE", "2026-08-20", 10_000),
      ],
    });
    const cancelled = credit({
      id: "c",
      codigo: "C",
      estado: "CANCELADO",
      monto: 300_000,
    });

    const all = calcularResumenCreditos([active, cancelled], "TODOS");
    const activeOnly = calcularResumenCreditos([active], "ACTIVO");

    expect(all.totalCreditos).toBe(2);
    expect(all.montoOriginal).toBe(400_000);
    expect(activeOnly.montoOriginal).toBe(100_000);
    expect(all.proximaCuota?.estado).toBe("PENDIENTE");
    expect(all.proximaCuota?.fechaProgramada.toISOString()).toContain("2026-08-20");
  });

});
