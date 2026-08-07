import { describe, expect, it } from "vitest";

import {
  debeMarcarCuotaAtrasada,
  obtenerCorteExclusivoCuotasVencidas,
} from "../overdue-policy";

function fecha(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("política de gracia para cuotas vencidas", () => {
  it("mantiene pendiente la cuota durante el día programado", () => {
    expect(debeMarcarCuotaAtrasada(fecha(2026, 8, 15), fecha(2026, 8, 15))).toBe(false);
  });

  it("mantiene pendiente la cuota durante el día calendario siguiente", () => {
    expect(debeMarcarCuotaAtrasada(fecha(2026, 8, 15), fecha(2026, 8, 16))).toBe(false);
  });

  it("marca la cuota como atrasada desde el segundo día posterior", () => {
    expect(debeMarcarCuotaAtrasada(fecha(2026, 8, 15), fecha(2026, 8, 17))).toBe(true);
  });

  it("mantiene la regla al cruzar de mes", () => {
    expect(obtenerCorteExclusivoCuotasVencidas(fecha(2026, 9, 1))).toEqual(fecha(2026, 8, 31));
    expect(debeMarcarCuotaAtrasada(fecha(2026, 8, 30), fecha(2026, 9, 1))).toBe(true);
    expect(debeMarcarCuotaAtrasada(fecha(2026, 8, 31), fecha(2026, 9, 1))).toBe(false);
  });
});
