import { describe, expect, it } from "vitest";

import { calcularResumenCarteraCliente } from "../portfolio-summary";

function cuota(
  estado: "PENDIENTE" | "ATRASADO" | "MORA" | "PAGADO" | "CANCELADO_POR_ABONO",
  interesProgramado: number,
) {
  return {
    tipo: "CUOTA_PROGRAMADA" as const,
    estado,
    interesProgramado,
  };
}

describe("calcularResumenCarteraCliente", () => {
  it("suma el interés programado de cuotas operativas de créditos activos", () => {
    const result = calcularResumenCarteraCliente([
      {
        estado: "ACTIVO",
        eventos: [
          cuota("PENDIENTE", 20_000),
          cuota("ATRASADO", 15_000),
          cuota("MORA", 10_000),
        ],
      },
    ]);

    expect(result).toEqual({
      interesPendienteTotal: 45_000,
      estadoCartera: "MORA",
    });
  });

  it("excluye cuotas pagadas, canceladas por abono y eventos de abono", () => {
    const result = calcularResumenCarteraCliente([
      {
        estado: "ACTIVO",
        eventos: [
          cuota("PENDIENTE", 12_000),
          cuota("PAGADO", 9_000),
          cuota("CANCELADO_POR_ABONO", 7_000),
          {
            tipo: "ABONO_CAPITAL",
            estado: "PAGADO",
            interesProgramado: 50_000,
          },
        ],
      },
    ]);

    expect(result).toEqual({
      interesPendienteTotal: 12_000,
      estadoCartera: "AL_DIA",
    });
  });

  it("excluye completamente los créditos cancelados", () => {
    const result = calcularResumenCarteraCliente([
      {
        estado: "CANCELADO",
        eventos: [cuota("MORA", 80_000)],
      },
    ]);

    expect(result).toEqual({
      interesPendienteTotal: 0,
      estadoCartera: "SIN_CREDITOS_ACTIVOS",
    });
  });

  it("prioriza mora sobre atraso y atraso sobre al día", () => {
    expect(
      calcularResumenCarteraCliente([
        { estado: "ACTIVO", eventos: [cuota("PENDIENTE", 1)] },
      ]).estadoCartera,
    ).toBe("AL_DIA");

    expect(
      calcularResumenCarteraCliente([
        { estado: "ACTIVO", eventos: [cuota("ATRASADO", 1)] },
      ]).estadoCartera,
    ).toBe("ATRASADO");

    expect(
      calcularResumenCarteraCliente([
        {
          estado: "ACTIVO",
          eventos: [cuota("ATRASADO", 1), cuota("MORA", 1)],
        },
      ]).estadoCartera,
    ).toBe("MORA");
  });

  it("ignora intereses inválidos o negativos", () => {
    const result = calcularResumenCarteraCliente([
      {
        estado: "ACTIVO",
        eventos: [
          cuota("PENDIENTE", -100),
          {
            tipo: "CUOTA_PROGRAMADA",
            estado: "PENDIENTE",
            interesProgramado: Number.NaN,
          },
        ],
      },
    ]);

    expect(result.interesPendienteTotal).toBe(0);
  });
});
