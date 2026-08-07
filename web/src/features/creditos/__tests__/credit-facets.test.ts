import { describe, expect, it } from "vitest";

import {
  buildCreditFacetCatalogs,
  matchesCreditFilters,
  type CreditFacetFilters,
  type CreditFacetSource,
} from "../credit-facets";

const baseFilters: CreditFacetFilters = {
  query: "",
  segmento: "TODOS",
  codigos: [],
  clientes: [],
  montos: [],
  montoMin: null,
  montoMax: null,
  capitales: [],
  capitalMin: null,
  capitalMax: null,
  intereses: [],
  interesMin: null,
  interesMax: null,
  proximaFechaDesde: null,
  proximaFechaHasta: null,
  proximaValorMin: null,
  proximaValorMax: null,
  sinProximaCuota: false,
  tasas: [],
  tasaMin: null,
  tasaMax: null,
};

function credit(id: string, clientId: string, amount: number, interest: number): CreditFacetSource {
  return {
    id,
    codigo: `LP-${id}`,
    estado: "ACTIVO",
    creadoEn: new Date("2026-08-01T12:00:00"),
    fechaPrestamo: new Date("2026-07-01T12:00:00"),
    fechaCancelacion: null,
    monto: amount,
    plazoMeses: 2,
    tasaMensual: 0.2,
    frecuencia: "MENSUAL",
    tipoAmortizacion: "AMORTIZACION_FIJA",
    cliente: { id: clientId, nombre: `Cliente ${clientId}`, cedula: clientId, telefono: null },
    eventos: [{
      numeroCuota: 1,
      tipo: "CUOTA_PROGRAMADA",
      estado: "PENDIENTE",
      fechaProgramada: new Date("2026-09-01T12:00:00"),
      valorProgramado: amount / 2 + interest,
      interesProgramado: interest,
      saldoCapitalPost: amount / 2,
    }],
  };
}

describe("facetas globales de créditos", () => {
  it("aplica búsqueda y filtros financieros derivados", () => {
    const source = credit("1", "A", 100_000, 10_000);
    expect(matchesCreditFilters(source, { ...baseFilters, query: "cliente a" })).toBe(true);
    expect(matchesCreditFilters(source, { ...baseFilters, capitalMin: 150_000 })).toBe(false);
    expect(matchesCreditFilters(source, { ...baseFilters, interesMin: 9_000 })).toBe(true);
  });

  it("excluye solo la faceta propia al construir catálogos", () => {
    const credits = [credit("1", "A", 100_000, 10_000), credit("2", "B", 200_000, 20_000)];
    const filters = { ...baseFilters, clientes: ["A"], montos: [200_000] };
    const catalogs = buildCreditFacetCatalogs(credits, filters);

    // The Client facet omits its own selection while applying Amount, so B is
    // available. A remains visible because it is selected and must be removable.
    expect(catalogs.clientes.map((value) => value.id)).toEqual(["A", "B"]);
    // The Amount facet omits itself while applying Client A. The matching value
    // is 100,000 and the selected 200,000 remains available for removal.
    expect(catalogs.montos).toEqual([100_000, 200_000]);
  });

  it("filtra próxima cuota por rango y por ausencia", () => {
    const withInstallment = credit("1", "A", 100_000, 10_000);
    const withoutInstallment = { ...credit("2", "B", 100_000, 10_000), eventos: [] };

    expect(matchesCreditFilters(withInstallment, { ...baseFilters, proximaValorMin: 60_000 })).toBe(true);
    expect(matchesCreditFilters(withInstallment, { ...baseFilters, sinProximaCuota: true })).toBe(false);
    expect(matchesCreditFilters(withoutInstallment, { ...baseFilters, sinProximaCuota: true })).toBe(true);
  });
});
