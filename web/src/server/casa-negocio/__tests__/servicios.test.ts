/**
 * Service contract without a database: capability first, then zod, then one
 * transaction whose audit row is written through the transaction client, and
 * the optimistic lock refusing stale versions. The end-to-end behaviour
 * against PostgreSQL lives in casa-negocio.integration.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    cnCuenta: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    cnCategoriaGasto: { findUnique: vi.fn() },
    cnMovimiento: { create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    cnAsignacionCuenta: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    cnPermiso: { findMany: vi.fn() },
    cnMovimiento: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma, user: { id: "u1", nombre: "Padre", roles: ["ADMIN"] } };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/auth/guards", () => ({
  requireUser: vi.fn(async () => h.user),
  hasRole: (user: { roles: string[] }, role: string) => user.roles.includes(role),
}));

import { ConcurrentModificationError } from "@/server/optimistic-lock";
import { InputValidationError } from "@/server/validation/input";

import { CasaNegocioPermisoError, CasaNegocioReglaError } from "../errors";
import { anularMovimiento, editarMovimiento, registrarMovimiento } from "../movimientos";

const APERTURA = new Date("2026-11-01T05:00:00.000Z");
const CUENTAS = {
  efectivo: { id: "efectivo", nombre: "Efectivo", grupo: "NEGOCIO", archivada: false, fechaSaldoInicial: APERTURA },
  casa: { id: "casa", nombre: "Cuenta casa", grupo: "CASA", archivada: false, fechaSaldoInicial: APERTURA },
} as const;

const entrada = {
  operationKey: "6f1c2b9a-0000-4000-8000-000000000001",
  tipo: "RETIRO_CASA",
  fecha: "2026-11-12",
  monto: "300.000",
  cuentaOrigenId: "efectivo",
  cuentaDestinoId: "casa",
};

function conCapacidades(...capacidades: string[]) {
  h.prisma.cnPermiso.findMany.mockResolvedValue(capacidades.map((capacidad) => ({ capacidad })));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.cnMovimiento.findUnique.mockResolvedValue(null);
  h.tx.cnCuenta.findUnique.mockImplementation(async ({ where }: { where: { id: keyof typeof CUENTAS } }) => CUENTAS[where.id] ?? null);
  h.tx.cnCuenta.findUniqueOrThrow.mockResolvedValue({ id: "efectivo", saldoInicial: "1000000.00", fechaSaldoInicial: APERTURA });
  h.tx.cnCategoriaGasto.findUnique.mockResolvedValue(null);
  h.tx.cnMovimiento.findMany.mockResolvedValue([]);
  h.tx.cnAsignacionCuenta.findMany.mockResolvedValue([]);
  h.tx.cnMovimiento.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "m1",
    ...data,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }));
});

describe("registrarMovimiento", () => {
  it("sin casa_negocio.anotar se niega antes de validar o tocar la base", async () => {
    conCapacidades("VER");
    await expect(registrarMovimiento({ basura: true })).rejects.toBeInstanceOf(CasaNegocioPermisoError);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("con datos inválidos falla en zod y no abre transacción", async () => {
    conCapacidades("VER", "ANOTAR");
    await expect(registrarMovimiento({ ...entrada, monto: "-5" })).rejects.toBeInstanceOf(InputValidationError);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("guarda el monto como Decimal exacto, audita dentro de la transacción y devuelve el saldo de origen", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.cnMovimiento.findMany.mockResolvedValue([
      { fecha: new Date("2026-11-12T05:00:00.000Z"), monto: "300000.00", cuentaOrigenId: "efectivo", cuentaDestinoId: "casa" },
    ]);
    const res = await registrarMovimiento(entrada);

    expect(res).toEqual({ movimientoId: "m1", repetido: false, saldoOrigenDespues: 700_000 });
    expect(h.tx.cnMovimiento.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "RETIRO_CASA", monto: "300000.00", accionPor: "u1", idempotencyKey: entrada.operationKey }),
    });
    expect(h.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: "u1", action: "casa_negocio.movimiento.registrar", entityType: "CnMovimiento", entityId: "m1" }),
    });
  });

  it("una clave repetida devuelve el movimiento existente sin escribir", async () => {
    conCapacidades("VER", "ANOTAR");
    h.prisma.cnMovimiento.findUnique.mockResolvedValue({ id: "m0", cuentaOrigenId: "efectivo" });
    await expect(registrarMovimiento(entrada)).resolves.toMatchObject({ movimientoId: "m0", repetido: true });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("una regla de negocio rota no escribe ni audita", async () => {
    conCapacidades("VER", "ANOTAR");
    await expect(registrarMovimiento({ ...entrada, tipo: "TRASLADO" })).rejects.toBeInstanceOf(CasaNegocioReglaError);
    expect(h.tx.cnMovimiento.create).not.toHaveBeenCalled();
    expect(h.tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("edición y anulación con bloqueo optimista", () => {
  const fila = {
    id: "m1",
    tipo: "RETIRO_CASA",
    fecha: new Date("2026-11-12T05:00:00.000Z"),
    monto: "300000.00",
    cuentaOrigenId: "efectivo",
    cuentaDestinoId: "casa",
    categoriaId: null,
    nota: null,
    eliminadoEn: null,
    actualizadoEn: new Date("2026-11-20T10:00:00.000Z"),
  };
  const { operationKey: _key, ...campos } = entrada;
  void _key;

  it("una versión vieja no sobrescribe y no deja auditoría", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.cnMovimiento.findUnique.mockResolvedValue(fila);
    h.tx.cnMovimiento.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      editarMovimiento({ ...campos, movimientoId: "m1", version: "2026-11-19T10:00:00.000Z", monto: "250.000" }),
    ).rejects.toBeInstanceOf(ConcurrentModificationError);
    expect(h.tx.cnMovimiento.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "m1", eliminadoEn: null, actualizadoEn: { gte: expect.any(Date), lt: expect.any(Date) } }),
      }),
    );
    expect(h.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("anular marca el movimiento, guarda el motivo y lo audita", async () => {
    conCapacidades("VER", "ANOTAR");
    h.tx.cnMovimiento.findUnique.mockResolvedValue(fila);
    h.tx.cnMovimiento.updateMany.mockResolvedValue({ count: 1 });
    await anularMovimiento({ movimientoId: "m1", version: fila.actualizadoEn.toISOString(), motivo: "Duplicado" });
    expect(h.tx.cnMovimiento.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eliminadoPor: "u1", motivoEliminacion: "Duplicado" }) }),
    );
    expect(h.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "casa_negocio.movimiento.anular", reason: "Duplicado" }),
    });
  });

  it("anular exige el motivo", async () => {
    conCapacidades("VER", "ANOTAR");
    await expect(anularMovimiento({ movimientoId: "m1", version: fila.actualizadoEn.toISOString(), motivo: " " })).rejects.toBeInstanceOf(
      InputValidationError,
    );
  });
});
