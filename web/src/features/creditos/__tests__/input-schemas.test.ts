import { describe, expect, it } from "vitest";

import { registrarAbonoSchema, reversarAbonoSchema } from "../abonos/schemas";
import { condicionesCreditoSchema, crearCreditoSchema } from "../crear/schemas";
import { actualizarCreditoSchema, eliminarCreditoSchema } from "../editar/schemas";
import { actualizarFechaPagoSchema, cuotaSchema } from "../pagos/schemas";
import { extenderPlazoSchema, reversarExtensionSchema } from "../plazos/schemas";
import { transferirClienteSchema, transferirCreditoSchema } from "../../transferencias/schemas";
import { todayInBogota } from "../../../server/validation/input";

const firstMessage = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.success ? undefined : result.error?.issues[0]?.message;

const condiciones = {
  fechaPrestamo: "2026-03-01",
  monto: "1.000.000",
  plazoMeses: "6",
  tasaMensual: "5%",
  frecuencia: "Mensual",
  tipoAmortizacion: "Amortización Fija",
} as const;

describe("registrarAbonoSchema", () => {
  it("parses a typical abono", () => {
    const parsed = registrarAbonoSchema.parse({ creditoId: "c1", montoAbono: "$ 250.000", fechaAbono: "2026-01-10" });
    expect(parsed.montoAbono).toBe(250000);
    expect(parsed.fechaAbono.getTime()).toBe(new Date(2026, 0, 10).getTime());
  });

  it("defaults a blank date to today in Bogota, as before", () => {
    const parsed = registrarAbonoSchema.parse({ creditoId: "c1", montoAbono: "1000", fechaAbono: "  " });
    expect(parsed.fechaAbono.getTime()).toBe(todayInBogota().getTime());
    const absent = registrarAbonoSchema.parse({ creditoId: "c1", montoAbono: "1000" });
    expect(absent.fechaAbono.getTime()).toBe(todayInBogota().getTime());
  });

  it("keeps the historical messages", () => {
    expect(firstMessage(registrarAbonoSchema.safeParse({ creditoId: "c1" }))).toBe("Falta el campo obligatorio montoAbono.");
    expect(firstMessage(registrarAbonoSchema.safeParse({ creditoId: "c1", montoAbono: "0" }))).toBe(
      "Ingresa un monto de abono válido mayor a cero.",
    );
    expect(firstMessage(registrarAbonoSchema.safeParse({ creditoId: "c1", montoAbono: "10", fechaAbono: "2999-01-01" }))).toBe(
      "La fecha del abono no puede estar en el futuro.",
    );
  });

  it("validates the reversal reason length", () => {
    expect(reversarAbonoSchema.parse({ creditoId: "c1", abonoEventoId: "e1", motivo: "  " }).motivo).toBeNull();
    expect(firstMessage(reversarAbonoSchema.safeParse({ creditoId: "c1", abonoEventoId: "e1", motivo: "x".repeat(501) }))).toBe(
      "El motivo no puede superar 500 caracteres.",
    );
  });
});

describe("extenderPlazoSchema", () => {
  it.each(["1", " 12 ", "60"])("accepts %j", (value) => {
    expect(extenderPlazoSchema.parse({ creditoId: "c1", cuotasExtra: value }).cuotasExtra).toBe(Number(value));
  });

  it.each(["0", "61", "2.5", "abc", "-1"])("rejects %j with the historical message", (value) => {
    expect(firstMessage(extenderPlazoSchema.safeParse({ creditoId: "c1", cuotasExtra: value }))).toBe(
      "Ingresa un número entero de cuotas extra entre 1 y 60.",
    );
  });

  it("requires the snapshot to reverse", () => {
    expect(firstMessage(reversarExtensionSchema.safeParse({ creditoId: "c1" }))).toBe("Falta el campo obligatorio snapshotId.");
  });
});

describe("pagos schemas", () => {
  it("requires both ids", () => {
    expect(cuotaSchema.parse({ eventoId: " e1 ", creditoId: "c1" })).toEqual({ eventoId: "e1", creditoId: "c1" });
    expect(firstMessage(cuotaSchema.safeParse({ creditoId: "c1" }))).toBe("Falta el campo obligatorio eventoId.");
  });

  it("validates the real payment date in the Bogota calendar", () => {
    const ok = actualizarFechaPagoSchema.parse({ eventoId: "e1", creditoId: "c1", fechaPago: "2026-02-28" });
    expect(ok.fechaPago.getTime()).toBe(new Date(2026, 1, 28).getTime());
    expect(firstMessage(actualizarFechaPagoSchema.safeParse({ eventoId: "e1", creditoId: "c1", fechaPago: "2026-02-29" }))).toBe(
      "La fecha real de pago no es una fecha válida en el calendario.",
    );
  });
});

describe("crédito schemas", () => {
  it("accepts the wizard payload and normalises the note", () => {
    const parsed = crearCreditoSchema.parse({ clienteId: "cl1", form: condiciones, nota: "  ", idempotencyKey: "k-1" });
    expect(parsed.nota).toBeNull();
    expect(parsed.form).toEqual(condiciones);
  });

  it("keeps the wizard's messages", () => {
    expect(firstMessage(crearCreditoSchema.safeParse({ clienteId: " ", form: condiciones, idempotencyKey: "k" }))).toBe(
      "Selecciona un cliente antes de guardar.",
    );
    expect(firstMessage(crearCreditoSchema.safeParse({ clienteId: "cl1", form: condiciones, idempotencyKey: "" }))).toBe(
      "No se pudo identificar la operación. Reinicia el flujo e inténtalo de nuevo.",
    );
    expect(
      firstMessage(crearCreditoSchema.safeParse({ clienteId: "cl1", form: condiciones, idempotencyKey: "k", nota: "x".repeat(1001) })),
    ).toBe("La nota no puede superar 1000 caracteres.");
  });

  it("accepts the empty selections the form starts with and rejects unknown enums", () => {
    expect(condicionesCreditoSchema.safeParse({ ...condiciones, frecuencia: "", tipoAmortizacion: "" }).success).toBe(true);
    expect(firstMessage(condicionesCreditoSchema.safeParse({ ...condiciones, frecuencia: "Semanal" }))).toBe(
      "La frecuencia de pago no es válida.",
    );
  });

  it("validates edit and soft delete", () => {
    expect(firstMessage(actualizarCreditoSchema.safeParse({ id: "", form: condiciones }))).toBe("Crédito inválido.");
    expect(firstMessage(eliminarCreditoSchema.safeParse({ id: "c1", motivo: "corto" }))).toBe(
      "Indica un motivo de eliminación entre 10 y 500 caracteres.",
    );
    expect(eliminarCreditoSchema.parse({ id: "c1", motivo: "  duplicado por error  " }).motivo).toBe("duplicado por error");
  });
});

describe("transfer schemas", () => {
  it("requires the record and the target owner", () => {
    expect(transferirCreditoSchema.parse({ creditoId: "c1", targetOwnerUserId: "u1", reason: "" })).toEqual({
      creditoId: "c1",
      targetOwnerUserId: "u1",
      reason: null,
    });
    expect(firstMessage(transferirClienteSchema.safeParse({ clienteId: "cl1" }))).toBe(
      "Falta el campo obligatorio targetOwnerUserId.",
    );
  });
});
