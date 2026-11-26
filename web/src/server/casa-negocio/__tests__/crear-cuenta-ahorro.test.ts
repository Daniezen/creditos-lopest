/**
 * «+ Cuenta» with «Es la cuenta de ahorro» ticked (the 1-dic Nu account):
 * the action creates the account and then makes it the savings account with
 * the settings row as the form last read it. The services are stubbed: their
 * own rules (CONFIGURAR, zod, locks) have their tests in
 * acciones-configuracion.test.ts; this file pins the composition.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  crearCuenta: vi.fn(),
  editarConfiguracion: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/casa-negocio/configuracion", () => ({
  crearCuenta: h.crearCuenta,
  editarConfiguracion: h.editarConfiguracion,
  archivarCuenta: vi.fn(),
  crearCategoria: vi.fn(),
  definirCapacidades: vi.fn(),
  editarCategoria: vi.fn(),
  editarCuenta: vi.fn(),
  editarReglaAviso: vi.fn(),
  eliminarCuenta: vi.fn(),
}));

import { crearCuentaAction } from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { CasaNegocioReglaError } from "@/server/casa-negocio/errors";

const NU = { nombre: "Nu", grupo: "CASA", tipo: "AHORRO", saldoInicial: "7.006.000", fechaSaldoInicial: "2026-12-01", orden: "0" };
const AJUSTES = { configVersion: "2026-11-25T15:00:00.000Z", metaAsignacionCasa: "5.500.000", metaAhorro: "" };

beforeEach(() => {
  vi.clearAllMocks();
  h.crearCuenta.mockResolvedValue({ cuentaId: "nu" });
  h.editarConfiguracion.mockResolvedValue(undefined);
});

describe("crear una cuenta y dejarla como cuenta de ahorro", () => {
  it("sin la marca solo crea la cuenta, y el servicio no ve los campos extra", async () => {
    const r = await crearCuentaAction({ ...NU, esAhorro: "false", ...AJUSTES });
    expect(r).toEqual({ ok: true });
    expect(h.crearCuenta).toHaveBeenCalledWith(NU);
    expect(h.editarConfiguracion).not.toHaveBeenCalled();
    expect(h.revalidatePath).toHaveBeenCalledWith("/casa-negocio", "layout");
  });

  it("con la marca elige la cuenta recién creada, conservando las metas leídas", async () => {
    const r = await crearCuentaAction({ ...NU, esAhorro: "true", ...AJUSTES });
    expect(r).toEqual({ ok: true });
    expect(h.editarConfiguracion).toHaveBeenCalledWith({
      version: AJUSTES.configVersion,
      metaAsignacionCasa: "5.500.000",
      metaAhorro: "",
      cuentaAhorroId: "nu",
    });
  });

  it("si la cuenta no se crea, no toca la configuración ni revalida", async () => {
    h.crearCuenta.mockRejectedValue(new CasaNegocioReglaError("Ya existe una cuenta con ese nombre.", "nombre"));
    const r = await crearCuentaAction({ ...NU, esAhorro: "true", ...AJUSTES });
    expect(r).toEqual({ ok: false, error: "Ya existe una cuenta con ese nombre.", campos: { nombre: "Ya existe una cuenta con ese nombre." } });
    expect(h.editarConfiguracion).not.toHaveBeenCalled();
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("si falla el segundo paso, dice que la cuenta sí quedó creada (para no crearla dos veces)", async () => {
    h.editarConfiguracion.mockRejectedValue(new CasaNegocioReglaError("La cuenta de ahorro debe ser una cuenta de ahorro de la casa, activa."));
    const r = await crearCuentaAction({ ...NU, esAhorro: "true", ...AJUSTES });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/^La cuenta se creó, pero no quedó como cuenta de ahorro/);
    // The new card must show up anyway.
    expect(h.revalidatePath).toHaveBeenCalledWith("/casa-negocio", "layout");
  });
});
