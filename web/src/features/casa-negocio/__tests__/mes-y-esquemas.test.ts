import { describe, expect, it } from "vitest";

import { diasEntre, fechaClave, fechaDePagoEnMes, mesClave, rangoMes, sumarMeses } from "../mes";
import {
  asignarCuentaSchema,
  crearCategoriaSchema,
  editarReglaAvisoSchema,
  guardarArqueoSchema,
  registrarMovimientoSchema,
} from "../schemas";

describe("meses en America/Bogota", () => {
  it("el rango de diciembre empieza a medianoche de Bogotá y termina en enero", () => {
    const { inicio, fin } = rangoMes("2026-12");
    expect(inicio.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(fin.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });

  it("un pago a las 23:30 del 30-nov en Bogotá es de noviembre", () => {
    const pago = new Date("2026-12-01T04:30:00.000Z");
    expect(fechaClave(pago)).toBe("2026-11-30");
    expect(mesClave(pago)).toBe("2026-11");
  });

  it("suma meses cruzando el año y acota el día de pago al fin de mes", () => {
    expect(sumarMeses("2026-12", 1)).toBe("2027-01");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
    expect(fechaDePagoEnMes("2027-02", 31)).toBe("2027-02-28");
    expect(diasEntre("2026-11-25", "2026-12-01")).toBe(6);
  });

  it("rechaza meses inválidos", () => {
    expect(() => rangoMes("2026-13")).toThrow(RangeError);
  });
});

describe("esquemas de Casa y Negocio", () => {
  const base = { operationKey: "0b6c8a3e-1111-4c1a-9e1e-123456789abc", tipo: "GASTO_NEGOCIO", fecha: "2026-11-02", cuentaOrigenId: "c1" };

  it("lee montos colombianos y deja vacíos como null", () => {
    const parsed = registrarMovimientoSchema.parse({ ...base, monto: "$ 1.787.000", cuentaDestinoId: "", nota: "  " });
    expect(parsed).toMatchObject({ monto: 1787000, cuentaDestinoId: null, nota: null, categoriaId: null });
  });

  it("rechaza monto cero, fechas futuras y tipos desconocidos", () => {
    expect(registrarMovimientoSchema.safeParse({ ...base, monto: "0" }).success).toBe(false);
    expect(registrarMovimientoSchema.safeParse({ ...base, monto: "10", fecha: "2999-01-01" }).success).toBe(false);
    expect(registrarMovimientoSchema.safeParse({ ...base, monto: "10", tipo: "PRESTAMO" }).success).toBe(false);
  });

  it("una asignación apunta a un cobro o a un desembolso, no a ambos", () => {
    expect(asignarCuentaSchema.safeParse({ cuentaId: "c1", eventoFinancieroId: "e1", creditoId: "k1" }).success).toBe(false);
    expect(asignarCuentaSchema.safeParse({ cuentaId: "c1" }).success).toBe(false);
    expect(asignarCuentaSchema.parse({ cuentaId: "c1", creditoId: "k1", version: "" })).toMatchObject({ eventoFinancieroId: null, version: undefined });
  });

  it("un gasto anual necesita su mes y uno mensual lo descarta", () => {
    expect(crearCategoriaSchema.safeParse({ nombre: "SOAT", clase: "FIJO", periodicidad: "ANUAL", monto: "660.000" }).success).toBe(false);
    const mensual = crearCategoriaSchema.parse({ nombre: "Arriendo", clase: "FIJO", periodicidad: "MENSUAL", mesAnual: "3", diaPago: "17" });
    expect(mensual).toMatchObject({ mesAnual: null, diaPago: 17, activa: true, monto: null });
    expect(crearCategoriaSchema.safeParse({ nombre: "X", clase: "FIJO", periodicidad: "MENSUAL", diaPago: "32" }).success).toBe(false);
  });

  it("los avisos con umbral lo exigen y los demás lo rechazan", () => {
    const version = new Date().toISOString();
    expect(editarReglaAvisoSchema.safeParse({ codigo: "CUENTA_SIN_CONTAR", version, activa: "true" }).success).toBe(false);
    expect(editarReglaAvisoSchema.safeParse({ codigo: "ARQUEO_NO_CUADRA", version, activa: true, umbral: "5" }).success).toBe(false);
    expect(editarReglaAvisoSchema.safeParse({ codigo: "SOBRE_CERCA_DEL_TOPE", version, activa: true, umbral: "120" }).success).toBe(false);
    expect(editarReglaAvisoSchema.parse({ codigo: "SOBRE_CERCA_DEL_TOPE", version, activa: "on", umbral: "90" })).toMatchObject({ activa: true, umbral: 90 });
  });

  it("el arqueo admite contar cero pero no negativos ni cuentas repetidas", () => {
    const operationKey = base.operationKey;
    expect(guardarArqueoSchema.parse({ operationKey, conteos: [{ cuentaId: "c1", contado: "0" }] }).conteos[0].contado).toBe(0);
    expect(guardarArqueoSchema.safeParse({ operationKey, conteos: [{ cuentaId: "c1", contado: "-5" }] }).success).toBe(false);
    expect(
      guardarArqueoSchema.safeParse({ operationKey, conteos: [{ cuentaId: "c1", contado: "1" }, { cuentaId: "c1", contado: "2" }] }).success,
    ).toBe(false);
  });
});
