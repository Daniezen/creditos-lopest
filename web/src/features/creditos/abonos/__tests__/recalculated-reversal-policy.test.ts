import { describe, expect, it } from "vitest";
import { puedeRevertirAbonoRecalculando, recalcularSoloInteresTrasReversion } from "../recalculated-reversal-policy";

const base = {
  abonoId: "a1",
  abonoCreadoEn: new Date("2026-08-02T15:22:28Z"),
  tipoAmortizacion: "SOLO_INTERES",
};

describe("reversión recalculada", () => {
  it("permite el caso histórico extendido sin cuotas pagadas", () => {
    expect(puedeRevertirAbonoRecalculando({ ...base, eventos: [
      { id: "a1", tipo: "ABONO_CAPITAL", estado: "PAGADO", creadoEn: base.abonoCreadoEn },
      { id: "c1", tipo: "CUOTA_PROGRAMADA", estado: "ATRASADO", creadoEn: new Date("2026-08-03") },
      { id: "c2", tipo: "CUOTA_PROGRAMADA", estado: "PENDIENTE", creadoEn: new Date("2026-08-03") },
    ] })).toBe(true);
  });
  it("bloquea cuotas pagadas", () => {
    expect(puedeRevertirAbonoRecalculando({ ...base, eventos: [
      { id: "c1", tipo: "CUOTA_PROGRAMADA", estado: "PAGADO", creadoEn: new Date("2026-08-03") },
    ] })).toBe(false);
  });
  it("bloquea un abono posterior", () => {
    expect(puedeRevertirAbonoRecalculando({ ...base, eventos: [
      { id: "a2", tipo: "ABONO_CAPITAL", estado: "PAGADO", creadoEn: new Date("2026-08-03") },
    ] })).toBe(false);
  });
  it("recalcula siete cuotas de LP-26-0294", () => {
    const result = recalcularSoloInteresTrasReversion({ saldoRestaurado: 2_000_000, tasaMensual: 0.15, frecuencia: "MENSUAL", cuotas: Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1), numeroCuota: i + 1 })) });
    expect(result.slice(0, 6).every((c) => c.valorProgramado === 300_000 && c.capitalProgramado === 0 && c.saldoCapitalPost === 2_000_000)).toBe(true);
    expect(result[6]).toMatchObject({ valorProgramado: 2_300_000, capitalProgramado: 2_000_000, interesProgramado: 300_000, saldoCapitalPost: 0 });
  });
});
