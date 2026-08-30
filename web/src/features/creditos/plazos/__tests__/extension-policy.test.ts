import { describe, expect, it } from "vitest";
import { incrementoPlazoMeses, recalcularCuotasSoloInteres } from "../extension-policy";

describe("extensión segura de plazo", () => {
  it("recalcula únicamente cuotas operativas y conserva sus identificadores", () => {
    const result = recalcularCuotasSoloInteres({ saldoCapital: 2_000_000, tasaMensual: 0.15, frecuencia: "MENSUAL", cuotas: [
      { id: "paid", numeroCuota: 1, estado: "PAGADO" },
      { id: "late", numeroCuota: 2, estado: "ATRASADO" },
      { id: "future", numeroCuota: 3, estado: "PENDIENTE" },
    ] });
    expect(result.map((item) => item.id)).toEqual(["late", "future"]);
    expect(result.every((item) => item.interesProgramado === 300_000 && item.capitalProgramado === 0 && item.saldoCapitalPost === 2_000_000)).toBe(true);
  });
  it("usa la mitad de la tasa mensual para frecuencias quincenales", () => {
    const result = recalcularCuotasSoloInteres({ saldoCapital: 1_000_000, tasaMensual: 0.1, frecuencia: "QUINCENAL_5_20", cuotas: [{ id: "q", numeroCuota: 1, estado: "MORA" }] });
    expect(result[0]?.interesProgramado).toBe(50_000);
  });
  it("incrementa correctamente el plazo expresado en meses", () => {
    expect(incrementoPlazoMeses(3, "MENSUAL")).toBe(3);
    expect(incrementoPlazoMeses(3, "QUINCENAL_10_25")).toBe(1.5);
  });
});
