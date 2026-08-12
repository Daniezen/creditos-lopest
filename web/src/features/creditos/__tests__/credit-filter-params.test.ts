import { describe, expect, it } from "vitest";

import { parseCreditFilterParams } from "../credit-filter-params";

describe("parámetros URL de filtros de créditos", () => {
  it("normaliza listas, rangos, segmento y página", () => {
    const result = parseCreditFilterParams({
      q: "  María  ",
      estado: "VENCIDA",
      page: "3",
      codigos: "LP-1|LP-2|LP-1",
      clientes: "cliente-a|cliente-b",
      cuotasAtrasadas: "0|2|2|invalido|-1|3.5",
      montos: "100000|invalido|200000",
      capitalMin: "50000",
      sinProximaCuota: "1",
      proximaFechaDesde: "2026-08-01",
    });

    expect(result.page).toBe(3);
    expect(result.filters.query).toBe("María");
    expect(result.filters.segmento).toBe("VENCIDA");
    expect(result.filters.codigos).toEqual(["LP-1", "LP-2"]);
    expect(result.filters.cuotasAtrasadas).toEqual([0, 2]);
    expect(result.filters.montos).toEqual([100000, 200000]);
    expect(result.filters.capitalMin).toBe(50000);
    expect(result.filters.sinProximaCuota).toBe(true);
    expect(result.filters.proximaFechaDesde?.getFullYear()).toBe(2026);
  });

  it("descarta valores inválidos sin inventar filtros", () => {
    const result = parseCreditFilterParams({
      estado: "DESCONOCIDO",
      page: "-1",
      montoMin: "NaN",
      proximaFechaHasta: "2026-02-31",
    });

    expect(result.page).toBe(1);
    expect(result.filters.segmento).toBe("TODOS");
    expect(result.filters.montoMin).toBeNull();
    expect(result.filters.proximaFechaHasta).toBeNull();
  });
});
