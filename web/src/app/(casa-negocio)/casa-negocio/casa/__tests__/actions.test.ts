/**
 * Server Actions of Casa and Negocio, run through the real phase-1 services
 * with a stubbed Prisma: they must never throw to the client, must mark the
 * offending fields, must refuse without `casa_negocio.anotar`, must report a
 * stale version as a conflict, and must revalidate only on success.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    cnCuenta: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    cnCategoriaGasto: { findUnique: vi.fn() },
    cnMovimiento: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    cnAsignacionCuenta: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    credito: { findFirst: vi.fn() },
    eventoFinanciero: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    cnPermiso: { findMany: vi.fn() },
    cnMovimiento: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma, revalidatePath: vi.fn(), user: { id: "u1", nombre: "Padre", roles: ["ADMIN"] } };
});

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/auth/guards", () => ({
  requireUser: vi.fn(async () => h.user),
  hasRole: (user: { roles: string[] }, role: string) => user.roles.includes(role),
}));

import { CONCURRENT_MODIFICATION_MESSAGE } from "@/server/optimistic-lock";

import { asignarCuentaAction } from "../../negocio/actions";
import { anotarMovimientoAction, anularMovimientoAction, editarMovimientoAction } from "../actions";
import { MENSAJE_INESPERADO, fallo } from "../resultado-accion";

const APERTURA = new Date("2026-11-01T05:00:00.000Z");
const CUENTAS = {
  casa: { id: "casa", nombre: "Cuenta casa", grupo: "CASA", archivada: false, fechaSaldoInicial: APERTURA },
  banco: { id: "banco", nombre: "Bancolombia", grupo: "NEGOCIO", archivada: false, fechaSaldoInicial: APERTURA },
} as const;

const gastoFijo = {
  operationKey: "6f1c2b9a-0000-4000-8000-00000000aa01",
  tipo: "GASTO_FIJO",
  fecha: "2026-11-20",
  monto: "170.000",
  cuentaOrigenId: "casa",
  cuentaDestinoId: "",
  categoriaId: "seguros",
  nota: "",
};

function conCapacidades(...capacidades: string[]) {
  h.prisma.cnPermiso.findMany.mockResolvedValue(capacidades.map((capacidad) => ({ capacidad })));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.cnMovimiento.findUnique.mockResolvedValue(null);
  h.tx.cnCuenta.findUnique.mockImplementation(async ({ where }: { where: { id: keyof typeof CUENTAS } }) => CUENTAS[where.id] ?? null);
  h.tx.cnCuenta.findUniqueOrThrow.mockResolvedValue({ id: "casa", saldoInicial: "100000.00", fechaSaldoInicial: APERTURA });
  h.tx.cnCategoriaGasto.findUnique.mockResolvedValue({ id: "seguros", nombre: "Seguros Bolo", clase: "FIJO", activa: true });
  h.tx.cnMovimiento.findMany.mockResolvedValue([]);
  h.tx.cnAsignacionCuenta.findMany.mockResolvedValue([]);
  h.tx.cnMovimiento.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "m1",
    ...data,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }));
});

describe("anotarMovimientoAction", () => {
  it("registers, returns the origin balance for alert 7 and revalidates the module", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.cnMovimiento.findMany.mockResolvedValue([
      { fecha: new Date("2026-11-20T05:00:00.000Z"), monto: "170000.00", cuentaOrigenId: "casa", cuentaDestinoId: null },
    ]);
    const r = await anotarMovimientoAction(gastoFijo);
    expect(r).toEqual({ ok: true, mensaje: "Anotado.", datos: { movimientoId: "m1", repetido: false, saldoOrigenDespues: -70_000 } });
    expect(h.revalidatePath).toHaveBeenCalledWith("/casa-negocio", "layout");
  });

  it("a double submit with the same key is answered without writing twice", async () => {
    conCapacidades("VER", "ANOTAR");
    h.prisma.cnMovimiento.findUnique.mockResolvedValue({ id: "m0", cuentaOrigenId: "casa" });
    const r = await anotarMovimientoAction(gastoFijo);
    expect(r).toMatchObject({ ok: true, mensaje: "Ya estaba anotado.", datos: { movimientoId: "m0", repetido: true } });
    expect(h.tx.cnMovimiento.create).not.toHaveBeenCalled();
  });

  it("without casa_negocio.anotar it refuses with the permission message, nothing written", async () => {
    conCapacidades("VER");
    const r = await anotarMovimientoAction(gastoFijo);
    expect(r).toEqual({ ok: false, mensaje: "No tienes permiso para anotar movimientos en Casa y Negocio.", campos: {}, conflicto: false });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("marks every invalid field from zod", async () => {
    conCapacidades("VER", "ANOTAR");
    const r = await anotarMovimientoAction({ ...gastoFijo, monto: "", fecha: "2099-01-01" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.mensaje).toBe("Revisa los campos marcados.");
    expect(Object.keys(r.campos).sort()).toEqual(["fecha", "monto"]);
    expect(r.campos.monto).toBe("Falta el monto.");
  });

  it("puts a business-rule refusal on the field it names", async () => {
    conCapacidades("VER", "ANOTAR");
    const r = await anotarMovimientoAction({ ...gastoFijo, cuentaOrigenId: "banco" });
    expect(r).toMatchObject({ ok: false, campos: { cuentaOrigenId: "La plata debe salir de una cuenta de la casa." } });
  });
});

describe("editar y anular", () => {
  const fila = {
    id: "m1",
    tipo: "GASTO_FIJO",
    fecha: new Date("2026-11-20T05:00:00.000Z"),
    monto: "170000.00",
    cuentaOrigenId: "casa",
    cuentaDestinoId: null,
    categoriaId: "seguros",
    nota: null,
    eliminadoEn: null,
    actualizadoEn: new Date("2026-11-20T15:00:00.000Z"),
  };

  it("a stale version comes back as a conflict, not an exception", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.cnMovimiento.findUnique.mockResolvedValue(fila);
    h.tx.cnMovimiento.updateMany.mockResolvedValue({ count: 0 });
    const { operationKey: _k, ...resto } = gastoFijo;
    void _k;
    const r = await editarMovimientoAction({ ...resto, movimientoId: "m1", version: "2026-11-20T14:00:00.000Z" });
    expect(r).toEqual({ ok: false, mensaje: CONCURRENT_MODIFICATION_MESSAGE, campos: {}, conflicto: true });
    expect(h.revalidatePath).not.toHaveBeenCalled();
  });

  it("voiding asks for a reason", async () => {
    conCapacidades("VER", "ANOTAR");
    const r = await anularMovimientoAction({ movimientoId: "m1", version: fila.actualizadoEn.toISOString(), motivo: " " });
    expect(r).toMatchObject({ ok: false, campos: { motivo: "Falta el motivo." } });
  });

  it("voids under the lock and revalidates", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.cnMovimiento.findUnique.mockResolvedValue(fila);
    h.tx.cnMovimiento.updateMany.mockResolvedValue({ count: 1 });
    const r = await anularMovimientoAction({ movimientoId: "m1", version: fila.actualizadoEn.toISOString(), motivo: "Duplicado" });
    expect(r).toEqual({ ok: true, mensaje: "Movimiento anulado.", datos: { movimientoId: "m1" } });
    expect(h.revalidatePath).toHaveBeenCalledTimes(1);
  });
});

describe("asignarCuentaAction", () => {
  it("assigns the account of a disbursement still without one", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.credito.findFirst.mockResolvedValue({ fechaPrestamo: new Date("2026-11-14T05:00:00.000Z") });
    h.tx.cnAsignacionCuenta.findUnique.mockResolvedValue(null);
    h.tx.cnAsignacionCuenta.create.mockResolvedValue({ id: "as1", creditoId: "c3", cuentaId: "banco" });
    const r = await asignarCuentaAction({ creditoId: "c3", eventoFinancieroId: "", cuentaId: "banco", version: "" });
    expect(r).toEqual({ ok: true, mensaje: "Cuenta asignada.", datos: { asignacionId: "as1" } });
    expect(h.revalidatePath).toHaveBeenCalledWith("/casa-negocio", "layout");
  });

  it("refuses a household account for business money, on the cuenta field", async () => {
    conCapacidades("VER", "ANOTAR");
    const r = await asignarCuentaAction({ creditoId: "c3", cuentaId: "casa" });
    expect(r).toMatchObject({ ok: false, campos: { cuentaId: "Los cobros y desembolsos van a una cuenta del negocio." } });
  });

  it("without anotar it is refused", async () => {
    conCapacidades("VER");
    const r = await asignarCuentaAction({ creditoId: "c3", cuentaId: "banco" });
    expect(r).toMatchObject({ ok: false, conflicto: false });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("fallo", () => {
  it("hides unexpected errors behind a generic message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(fallo(new Error("connection reset"))).toEqual({ ok: false, mensaje: MENSAJE_INESPERADO, campos: {}, conflicto: false });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
