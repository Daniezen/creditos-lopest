/**
 * Day inputs of the module are stored as Bogota midnight (`D 05:00Z`)
 * whatever the TZ of the process. Production runs the web container in UTC,
 * where the generic `dateInput` would give `D 00:00Z` = the previous evening
 * in Bogota, moving a 1-dic movement or opening balance into November.
 *
 * Each case runs under several process time zones by switching `TZ` at
 * runtime (Node re-reads it for every local-time computation).
 */
import { afterEach, describe, expect, it } from "vitest";

import { fechaClave } from "../mes";
import { crearCuentaSchema, registrarMovimientoSchema } from "../schemas";

const TZ_ORIGINAL = process.env.TZ;
afterEach(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

const ZONAS = ["UTC", "America/Bogota", "Asia/Tokyo"];

describe.each(ZONAS)("con TZ=%s", (zona) => {
  it("el saldo inicial del 1-dic queda en la medianoche de Bogotá", () => {
    process.env.TZ = zona;
    const cuenta = crearCuentaSchema.parse({
      nombre: "Efectivo",
      grupo: "NEGOCIO",
      tipo: "EFECTIVO",
      saldoInicial: "1.250.000",
      fechaSaldoInicial: "2026-12-01",
    });
    expect(cuenta.fechaSaldoInicial.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(fechaClave(cuenta.fechaSaldoInicial)).toBe("2026-12-01");
  });

  it("la fecha de un movimiento cae en su día de Bogotá", () => {
    process.env.TZ = zona;
    const parsed = registrarMovimientoSchema.safeParse({
      operationKey: "11111111-1111-4111-8111-111111111111",
      tipo: "GASTO_NEGOCIO",
      fecha: "2026-01-01",
      monto: "20.000",
      cuentaOrigenId: "cuenta_1",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.fecha.toISOString()).toBe("2026-01-01T05:00:00.000Z");
  });
});
