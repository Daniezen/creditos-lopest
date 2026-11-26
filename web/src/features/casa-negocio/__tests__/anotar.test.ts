/**
 * «Anotar»: the panel's schema, its translation to `registrarMovimiento`
 * and the Server Action (capability first, errors next to each field,
 * service rule errors mapped back, idempotency key passed through,
 * revalidation after saving). The service itself is mocked here; its
 * own contract is pinned in server/casa-negocio/__tests__/servicios.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCapacidad: vi.fn(),
  registrarMovimiento: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/server/casa-negocio/capacidades", () => ({ requireCapacidad: h.requireCapacidad }));
vi.mock("@/server/casa-negocio/movimientos", () => ({ registrarMovimiento: h.registrarMovimiento }));

import { CasaNegocioPermisoError, CasaNegocioReglaError } from "@/server/casa-negocio/errors";

import { ANOTAR_ESTADO_INICIAL, aRegistroMovimiento, anotarSchema, campoDelPanel } from "../anotar";
import { anotarMovimientoAction } from "../anotar-actions";

const KEY = "0b6f6c1e-5d8a-4a5e-9a0f-2f8f2a1c9d11";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const gastoCasa = { tipo: "gastoCasa", operationKey: KEY, categoria: "mercado", cuentaOrigen: "casa", monto: "1.500.000", fecha: "2026-11-20" };

describe("esquema del panel", () => {
  it("acepta los seis tipos con sus dos campos", () => {
    const casos = [
      gastoCasa,
      { tipo: "ingresoCasa", origen: "Regalo", cuentaDestino: "casa" },
      { tipo: "gastoNegocio", concepto: "Papelería", cuentaOrigen: "banco" },
      { tipo: "aporte", origen: "cuenta:casa", cuentaDestino: "banco" },
      { tipo: "retiro", cuentaOrigen: "banco", cuentaDestino: "casa" },
      { tipo: "traslado", cuentaOrigen: "banco", cuentaDestino: "nequi" },
    ].map((c) => ({ operationKey: KEY, monto: "50000", fecha: "2026-11-20", ...c }));
    for (const caso of casos) expect(anotarSchema.safeParse(caso).success, caso.tipo).toBe(true);
  });

  it("dice qué falta junto a cada campo", () => {
    const r = anotarSchema.safeParse({ tipo: "gastoCasa", operationKey: KEY, categoria: "", cuentaOrigen: "", monto: "0", fecha: "2999-01-01" });
    expect(r.success).toBe(false);
    const errores = Object.fromEntries(r.error!.issues.map((i) => [i.path[0], i.message]));
    expect(errores).toMatchObject({
      categoria: "Elige la categoría.",
      cuentaOrigen: "Elige de dónde se pagó.",
      monto: "El monto debe ser mayor que cero.",
      fecha: "La fecha no puede ser posterior a hoy.",
    });
  });

  it("no deja trasladar a la misma cuenta", () => {
    const r = anotarSchema.safeParse({ tipo: "traslado", operationKey: KEY, cuentaOrigen: "banco", cuentaDestino: "banco", monto: "1", fecha: "2026-11-20" });
    expect(r.error?.issues[0]).toMatchObject({ path: ["cuentaDestino"], message: "Elige una cuenta distinta a la de salida." });
  });

  it("traduce a registrarMovimiento: el origen del aporte puede ser cuenta o nota", () => {
    const aporte = { tipo: "aporte", operationKey: KEY, cuentaDestino: "banco", monto: "50.000", fecha: "2026-11-20" };
    const desdeCuenta = anotarSchema.parse({ ...aporte, origen: "cuenta:casa" });
    expect(aRegistroMovimiento(desdeCuenta, { ...aporte })).toEqual({
      operationKey: KEY,
      tipo: "APORTE",
      monto: "50.000",
      fecha: "2026-11-20",
      cuentaDestinoId: "banco",
      cuentaOrigenId: "casa",
    });
    const externo = anotarSchema.parse({ ...aporte, origen: "Ahorros propios" });
    expect(aRegistroMovimiento(externo, aporte)).toMatchObject({ tipo: "APORTE", nota: "Ahorros propios" });
    const gasto = anotarSchema.parse(gastoCasa);
    expect(aRegistroMovimiento(gasto, gastoCasa)).toMatchObject({ tipo: "GASTO_VARIABLE", categoriaId: "mercado", cuentaOrigenId: "casa" });
  });

  it("ubica los errores del servicio en el campo del panel", () => {
    expect(campoDelPanel("aporte", "cuentaOrigenId")).toBe("origen");
    expect(campoDelPanel("retiro", "cuentaOrigenId")).toBe("cuentaOrigen");
    expect(campoDelPanel("gastoCasa", "categoriaId")).toBe("categoria");
    expect(campoDelPanel("gastoCasa", undefined)).toBeNull();
  });
});

describe("anotarMovimientoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requireCapacidad.mockResolvedValue({ id: "u1" });
    h.registrarMovimiento.mockResolvedValue({ movimientoId: "m1", repetido: false, saldoOrigenDespues: 0 });
  });

  it("sin la capacidad anotar no lee nada ni escribe", async () => {
    h.requireCapacidad.mockRejectedValue(new CasaNegocioPermisoError("No tienes permiso para anotar movimientos en Casa y Negocio."));
    const r = await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form(gastoCasa));
    expect(h.requireCapacidad).toHaveBeenCalledWith("ANOTAR");
    expect(r).toEqual({ status: "error", message: "No tienes permiso para anotar movimientos en Casa y Negocio.", fieldErrors: undefined, guardados: 0 });
    expect(h.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("devuelve los errores por campo y no llama al servicio", async () => {
    const r = await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form({ ...gastoCasa, monto: "", categoria: "" }));
    expect(r.status).toBe("error");
    expect(r.fieldErrors).toMatchObject({ monto: "Escribe el monto.", categoria: "Elige la categoría." });
    expect(h.registrarMovimiento).not.toHaveBeenCalled();
  });

  it("un tipo desconocido es un error general, no de campo", async () => {
    const r = await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form({ ...gastoCasa, tipo: "borrar" }));
    expect(r.message).toBe("Elige el tipo de movimiento.");
    expect(r.fieldErrors).toEqual({});
  });

  it("guarda, revalida el módulo y avisa una sola vez", async () => {
    const r = await anotarMovimientoAction({ ...ANOTAR_ESTADO_INICIAL, guardados: 2 }, form(gastoCasa));
    expect(h.registrarMovimiento).toHaveBeenCalledWith(expect.objectContaining({ operationKey: KEY, monto: "1.500.000", tipo: "GASTO_VARIABLE" }));
    expect(h.revalidatePath).toHaveBeenCalledWith("/casa-negocio", "layout");
    expect(r).toEqual({ status: "ok", message: null, guardados: 3 });
  });

  it("el doble envío llega con la misma llave: el servicio lo reconoce como repetido", async () => {
    h.registrarMovimiento.mockResolvedValueOnce({ movimientoId: "m1", repetido: false, saldoOrigenDespues: 0 });
    h.registrarMovimiento.mockResolvedValueOnce({ movimientoId: "m1", repetido: true, saldoOrigenDespues: null });
    await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form(gastoCasa));
    await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form(gastoCasa));
    const llaves = h.registrarMovimiento.mock.calls.map(([input]) => input.operationKey);
    expect(llaves).toEqual([KEY, KEY]);
  });

  it("una regla del servicio vuelve junto a su campo", async () => {
    h.registrarMovimiento.mockRejectedValue(new CasaNegocioReglaError("La cuenta Cuenta casa está archivada.", "cuentaOrigenId"));
    const r = await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form(gastoCasa));
    expect(r).toMatchObject({ status: "error", message: null, fieldErrors: { cuentaOrigen: "La cuenta Cuenta casa está archivada." } });
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("un fallo inesperado no filtra detalles", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.registrarMovimiento.mockRejectedValue(new Error("connection refused 10.0.0.3"));
    const r = await anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form(gastoCasa));
    expect(r.message).toBe("No se pudo guardar. Inténtalo de nuevo.");
    spy.mockRestore();
  });

  it("deja pasar el redirect a /login de una sesión vencida", async () => {
    h.requireCapacidad.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }));
    await expect(anotarMovimientoAction(ANOTAR_ESTADO_INICIAL, form(gastoCasa))).rejects.toThrow("NEXT_REDIRECT");
  });
});
