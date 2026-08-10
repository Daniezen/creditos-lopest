import { describe, expect, it } from "vitest";
import { esPosibleDuplicado, puedeBorrarseCredito } from "../deletion-policy";

describe("borrado trazable", () => {
  it("permite cuotas pendientes o atrasadas sin pagos", () => {
    expect(puedeBorrarseCredito([{ tipo: "CUOTA_PROGRAMADA", estado: "ATRASADO", montoPagado: 0, capitalPagado: 0, interesPagado: 0, fechaPago: null }])).toBe(true);
  });
  it("bloquea abonos y pagos activos", () => {
    expect(puedeBorrarseCredito([{ tipo: "ABONO_CAPITAL", estado: "PAGADO", montoPagado: 500000, capitalPagado: 500000, interesPagado: 0, fechaPago: new Date() }])).toBe(false);
  });
});

describe("posibles duplicados", () => {
  it("detecta Zamira aun cuando el monto difiere 25%", () => {
    expect(esPosibleDuplicado({ fechaPrestamo: new Date("2026-05-18"), tasaMensual: 0.15, frecuencia: "MENSUAL", tipoAmortizacion: "SOLO_INTERES", monto: 2_000_000 }, { fechaPrestamo: new Date("2026-05-18"), tasaMensual: 0.15, frecuencia: "MENSUAL", tipoAmortizacion: "SOLO_INTERES", monto: 1_500_000 })).toBe(true);
  });
});
