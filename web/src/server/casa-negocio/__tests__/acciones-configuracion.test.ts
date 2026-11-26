/**
 * Server Actions of the Configuración tab, end to end down to a stubbed
 * Prisma: capability checked on the server, zod field errors returned
 * inline, the last configurator protected, accounts with movements archived
 * instead of deleted, stale versions refused, and the module revalidated only
 * when something was written.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    user: { findUnique: vi.fn() },
    cnPermiso: { findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    cnCuenta: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    cnConfiguracion: { findUnique: vi.fn() },
    cnMovimiento: { count: vi.fn(), findMany: vi.fn() },
    cnAsignacionCuenta: { count: vi.fn(), findMany: vi.fn() },
    cnArqueoDetalle: { count: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    cnPermiso: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma, user: { id: "padre", nombre: "Padre", roles: ["ADMIN"] }, revalidatePath: vi.fn() };
});

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/auth/guards", () => ({
  requireUser: vi.fn(async () => h.user),
  hasRole: (user: { roles: string[] }, role: string) => user.roles.includes(role),
}));

import {
  archivarCuentaAction,
  crearCuentaAction,
  definirPermisosAction,
  editarCuentaAction,
  eliminarCuentaAction,
} from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { CONCURRENT_MODIFICATION_MESSAGE } from "@/server/optimistic-lock";

const VERSION = "2026-11-25T15:00:00.000Z";
const APERTURA = new Date("2026-12-01T05:00:00.000Z");
const EFECTIVO = {
  id: "efectivo",
  nombre: "Efectivo",
  grupo: "NEGOCIO",
  tipo: "EFECTIVO",
  saldoInicial: "0.00",
  fechaSaldoInicial: APERTURA,
  archivada: false,
  archivadaEn: null,
  orden: 0,
  actualizadoEn: new Date(VERSION),
};

function conCapacidades(...capacidades: string[]) {
  h.prisma.cnPermiso.findMany.mockResolvedValue(capacidades.map((capacidad) => ({ capacidad })));
}

beforeEach(() => {
  vi.clearAllMocks();
  conCapacidades("VER", "ANOTAR", "CONTAR", "CONFIGURAR");
  h.tx.cnCuenta.findUnique.mockResolvedValue(EFECTIVO);
  h.tx.cnCuenta.findUniqueOrThrow.mockResolvedValue(EFECTIVO);
  h.tx.cnCuenta.updateMany.mockResolvedValue({ count: 1 });
  h.tx.cnConfiguracion.findUnique.mockResolvedValue({ cuentaAhorroId: null });
  h.tx.cnMovimiento.count.mockResolvedValue(0);
  h.tx.cnMovimiento.findMany.mockResolvedValue([]);
  h.tx.cnAsignacionCuenta.count.mockResolvedValue(0);
  h.tx.cnAsignacionCuenta.findMany.mockResolvedValue([]);
  h.tx.cnArqueoDetalle.count.mockResolvedValue(0);
  h.tx.user.findUnique.mockResolvedValue({ id: "padre", activo: true });
});

describe("permisos", () => {
  it("quien solo tiene ver no puede crear una cuenta: se niega en el servidor sin abrir transacción", async () => {
    conCapacidades("VER");
    const r = await crearCuentaAction({ nombre: "Caja", grupo: "NEGOCIO", tipo: "EFECTIVO", saldoInicial: "0", fechaSaldoInicial: "2026-12-01" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("configuración") });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("anotar o contar no bastan para cambiar permisos", async () => {
    conCapacidades("VER", "ANOTAR", "CONTAR");
    const r = await definirPermisosAction({ userId: "madre", capacidades: ["VER", "CONFIGURAR"] });
    expect(r.ok).toBe(false);
    expect(h.tx.cnPermiso.createMany).not.toHaveBeenCalled();
  });

  it("los datos inválidos vuelven como errores por campo", async () => {
    const r = await crearCuentaAction({ nombre: "", grupo: "NEGOCIO", tipo: "EFECTIVO", saldoInicial: "-5", fechaSaldoInicial: "2026-12-01" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.campos).toMatchObject({ nombre: expect.any(String), saldoInicial: expect.any(String) });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("último configurador", () => {
  it("nadie puede quitarse configurar si queda sin ningún configurador", async () => {
    h.tx.cnPermiso.findMany.mockResolvedValue([{ capacidad: "VER" }, { capacidad: "CONFIGURAR" }]);
    h.tx.cnPermiso.count.mockResolvedValue(0);
    const r = await definirPermisosAction({ userId: "padre", capacidades: ["VER"] });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Alguien tiene que poder configurar") });
    expect(h.tx.cnPermiso.deleteMany).not.toHaveBeenCalled();
    expect(h.revalidatePath).not.toHaveBeenCalled();
    // The count runs after the advisory lock, so two concurrent removals serialize.
    expect(h.tx.$executeRaw).toHaveBeenCalled();
  });

  it("quitar ver a alguien con configurar también cuenta como quitarle configurar", async () => {
    h.tx.cnPermiso.findMany.mockResolvedValue([{ capacidad: "VER" }, { capacidad: "CONFIGURAR" }]);
    h.tx.cnPermiso.count.mockResolvedValue(0);
    const r = await definirPermisosAction({ userId: "padre", capacidades: [] });
    expect(r.ok).toBe(false);
  });

  it("con otro configurador activo sí se puede, queda auditado y revalida el módulo", async () => {
    h.tx.cnPermiso.findMany.mockResolvedValue([{ capacidad: "VER" }, { capacidad: "CONFIGURAR" }]);
    h.tx.cnPermiso.count.mockResolvedValue(1);
    const r = await definirPermisosAction({ userId: "padre", capacidades: ["VER"] });
    expect(r).toEqual({ ok: true });
    expect(h.tx.cnPermiso.deleteMany).toHaveBeenCalledWith({ where: { userId: "padre", capacidad: { in: ["CONFIGURAR"] } } });
    expect(h.tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(h.revalidatePath).toHaveBeenCalledWith("/casa-negocio", "layout");
  });
});

describe("archivar con movimientos", () => {
  it("una cuenta con movimientos no se borra: se pide archivarla", async () => {
    h.tx.cnMovimiento.count.mockResolvedValue(3);
    const r = await eliminarCuentaAction({ cuentaId: "efectivo", version: VERSION });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("se archiva") });
    expect(h.tx.cnCuenta.delete).not.toHaveBeenCalled();
  });

  it("un cobro asignado o un arqueo también cuentan como movimientos", async () => {
    h.tx.cnArqueoDetalle.count.mockResolvedValue(1);
    expect((await eliminarCuentaAction({ cuentaId: "efectivo", version: VERSION })).ok).toBe(false);
    h.tx.cnArqueoDetalle.count.mockResolvedValue(0);
    h.tx.cnAsignacionCuenta.count.mockResolvedValue(1);
    expect((await eliminarCuentaAction({ cuentaId: "efectivo", version: VERSION })).ok).toBe(false);
    expect(h.tx.cnCuenta.delete).not.toHaveBeenCalled();
  });

  it("la misma cuenta, con saldo en cero, sí se archiva y queda auditado", async () => {
    h.tx.cnMovimiento.count.mockResolvedValue(3);
    const r = await archivarCuentaAction({ cuentaId: "efectivo", version: VERSION, archivada: "true" });
    expect(r).toEqual({ ok: true });
    expect(h.tx.cnCuenta.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ archivada: true }) }),
    );
    expect(h.tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("con saldo no se archiva (la plata desaparecería de dónde está la plata)", async () => {
    h.tx.cnCuenta.findUnique.mockResolvedValue({ ...EFECTIVO, saldoInicial: "250000.00" });
    const r = await archivarCuentaAction({ cuentaId: "efectivo", version: VERSION, archivada: "true" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("saldo") });
    expect(h.tx.cnCuenta.updateMany).not.toHaveBeenCalled();
  });

  it("una cuenta sin nada se borra, auditada", async () => {
    const r = await eliminarCuentaAction({ cuentaId: "efectivo", version: VERSION });
    expect(r).toEqual({ ok: true });
    expect(h.tx.cnCuenta.delete).toHaveBeenCalledWith({ where: { id: "efectivo" } });
    expect(h.tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("la cuenta de ahorro elegida no se borra", async () => {
    h.tx.cnConfiguracion.findUnique.mockResolvedValue({ cuentaAhorroId: "efectivo" });
    const r = await eliminarCuentaAction({ cuentaId: "efectivo", version: VERSION });
    expect(r.ok).toBe(false);
    expect(h.tx.cnCuenta.delete).not.toHaveBeenCalled();
  });
});

describe("bloqueo optimista y errores inesperados", () => {
  it("una versión vieja se rechaza con el mensaje de conflicto", async () => {
    h.tx.cnCuenta.updateMany.mockResolvedValue({ count: 0 });
    const r = await editarCuentaAction({
      cuentaId: "efectivo",
      version: VERSION,
      nombre: "Efectivo",
      tipo: "EFECTIVO",
      saldoInicial: "0",
      fechaSaldoInicial: "2026-12-01",
    });
    expect(r).toEqual({ ok: false, error: CONCURRENT_MODIFICATION_MESSAGE });
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("un fallo inesperado se registra y no filtra detalles al navegador", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    h.tx.cnCuenta.delete.mockRejectedValue(new Error("connection reset by peer at 10.0.0.3"));
    const r = await eliminarCuentaAction({ cuentaId: "efectivo", version: VERSION });
    expect(r).toEqual({ ok: false, error: expect.not.stringContaining("10.0.0.3") });
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });
});
