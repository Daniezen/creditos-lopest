/**
 * Server actions of the Ahorro and Arqueo tabs, without a database:
 * capabilities are checked on the server before anything is read or written,
 * the cierre goes to savings once per month whatever the client sends, and
 * every failure comes back as a message for the form (never a thrown Error).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const tx = {
    cnCuenta: { findMany: vi.fn() },
    cnArqueo: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    cnPermiso: { findMany: vi.fn() },
    cnMovimiento: { findMany: vi.fn() },
    cnCuenta: { findUnique: vi.fn() },
    cnArqueo: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return {
    tx,
    prisma,
    pasarAlAhorro: vi.fn(),
    saldo: { valor: 833_000 },
    user: { id: "u1", nombre: "Padre", roles: ["ADMIN"] },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/auth/guards", () => ({
  requireUser: vi.fn(async () => h.user),
  hasRole: (user: { roles: string[] }, role: string) => user.roles.includes(role),
}));
vi.mock("../movimientos", () => ({ pasarAlAhorro: h.pasarAlAhorro }));
vi.mock("../saldos", () => ({
  cargarAsientos: vi.fn(async () => []),
  saldosActuales: vi.fn((cuentas: { id: string }[]) => new Map(cuentas.map((c) => [c.id, h.saldo.valor]))),
}));

import { guardarArqueoAction } from "@/app/(casa-negocio)/casa-negocio/arqueo/actions";
import { pasarCierreAlAhorroAction } from "@/app/(casa-negocio)/casa-negocio/ahorro/actions";

import { CasaNegocioPermisoError } from "../errors";
import { pasarCierreAlAhorro } from "../vista-ahorro";

const AHORA = new Date("2026-11-25T17:00:00.000Z");
const CIERRE = { mes: "2026-11", cuentaOrigenId: "casa", monto: "631.000" };

function conCapacidades(...capacidades: string[]) {
  h.prisma.cnPermiso.findMany.mockResolvedValue(capacidades.map((capacidad) => ({ capacidad })));
}

function cierreGuardado(id: string, n: number, anulado: boolean, monto = "631000.00") {
  return { id, idempotencyKey: `ahorro-cierre-2026-11-${n}`, fecha: AHORA, monto, eliminadoEn: anulado ? AHORA : null };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.saldo.valor = 833_000;
  h.prisma.cnMovimiento.findMany.mockResolvedValue([]);
  h.prisma.cnCuenta.findUnique.mockResolvedValue({
    id: "casa",
    nombre: "Cuenta casa",
    grupo: "CASA",
    saldoInicial: "833000.00",
    fechaSaldoInicial: new Date("2026-11-01T05:00:00.000Z"),
  });
  h.pasarAlAhorro.mockResolvedValue({ movimientoId: "mov-1", repetido: false, saldoOrigenDespues: 202_000 });
});

describe("Pasar al ahorro (cierre del mes)", () => {
  it("demands `anotar` before reading anything", async () => {
    conCapacidades("VER", "CONTAR");
    await expect(pasarCierreAlAhorro(CIERRE, AHORA)).rejects.toBeInstanceOf(CasaNegocioPermisoError);
    expect(h.prisma.cnMovimiento.findMany).not.toHaveBeenCalled();
    expect(h.pasarAlAhorro).not.toHaveBeenCalled();
  });

  it("the action turns the refusal into a message and moves nothing", async () => {
    conCapacidades("VER");
    const r = await pasarCierreAlAhorroAction(CIERRE);
    expect(r).toEqual({ ok: false, mensaje: "No tienes permiso para anotar movimientos en Casa y Negocio." });
    expect(h.pasarAlAhorro).not.toHaveBeenCalled();
  });

  it("first time: one TRASLADO through the phase-1 service, with the month's key and today's date", async () => {
    conCapacidades("VER", "ANOTAR");
    const r = await pasarCierreAlAhorro(CIERRE, AHORA);
    expect(r).toEqual({ movimientoId: "mov-1", repetido: false, monto: 631_000 });
    expect(h.prisma.cnMovimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotencyKey: { startsWith: "ahorro-cierre-2026-11-" } } }),
    );
    expect(h.pasarAlAhorro).toHaveBeenCalledWith({
      operationKey: "ahorro-cierre-2026-11-0",
      cuentaOrigenId: "casa",
      monto: "631000,00",
      fecha: "2026-11-25",
      nota: "Cierre de noviembre",
    });
  });

  it("is idempotent: a month already passed answers with that transfer and moves nothing again", async () => {
    conCapacidades("VER", "ANOTAR");
    h.prisma.cnMovimiento.findMany.mockResolvedValue([cierreGuardado("mov-1", 0, false)]);
    // Even with another amount or another origin, the month is done.
    const r = await pasarCierreAlAhorro({ ...CIERRE, monto: "100.000" }, AHORA);
    expect(r).toEqual({ movimientoId: "mov-1", repetido: true, monto: 631_000 });
    expect(h.pasarAlAhorro).not.toHaveBeenCalled();

    const a = await pasarCierreAlAhorroAction(CIERRE);
    expect(a).toMatchObject({ ok: true, mensaje: "Este cierre ya estaba en el ahorro." });
  });

  it("a double click racing the first one lands on the same key, so the service replays it", async () => {
    conCapacidades("VER", "ANOTAR");
    h.pasarAlAhorro.mockResolvedValueOnce({ movimientoId: "mov-1", repetido: false, saldoOrigenDespues: 0 });
    h.pasarAlAhorro.mockResolvedValueOnce({ movimientoId: "mov-1", repetido: true, saldoOrigenDespues: null });
    // Both requests read the month before either commits (findMany stays empty for both).
    const a = await pasarCierreAlAhorro(CIERRE, AHORA);
    const b = await pasarCierreAlAhorro(CIERRE, AHORA);
    const claves = h.pasarAlAhorro.mock.calls.map(([input]) => (input as { operationKey: string }).operationKey);
    expect(new Set(claves)).toEqual(new Set(["ahorro-cierre-2026-11-0"]));
    expect([a.repetido, b.repetido].sort()).toEqual([false, true]);
    expect(a.movimientoId).toBe(b.movimientoId);
  });

  it("after the transfer was voided, the month can be passed again with the next key", async () => {
    conCapacidades("VER", "ANOTAR");
    h.prisma.cnMovimiento.findMany.mockResolvedValue([cierreGuardado("mov-0", 0, true), cierreGuardado("mov-1", 1, true)]);
    await pasarCierreAlAhorro(CIERRE, AHORA);
    expect(h.pasarAlAhorro).toHaveBeenCalledWith(expect.objectContaining({ operationKey: "ahorro-cierre-2026-11-2" }));
  });

  it("refuses more than the household account holds, a business account and a month not started", async () => {
    conCapacidades("VER", "ANOTAR");
    h.saldo.valor = 500_000;
    const mas = await pasarCierreAlAhorroAction(CIERRE);
    expect(mas).toMatchObject({ ok: false, campo: "monto" });

    h.saldo.valor = 833_000;
    h.prisma.cnCuenta.findUnique.mockResolvedValueOnce({ id: "banco", nombre: "Bancolombia", grupo: "NEGOCIO", saldoInicial: "0", fechaSaldoInicial: AHORA });
    expect(await pasarCierreAlAhorroAction({ ...CIERRE, cuentaOrigenId: "banco" })).toMatchObject({ ok: false, campo: "cuentaOrigenId" });

    await expect(pasarCierreAlAhorro({ ...CIERRE, mes: "2026-12" }, AHORA)).rejects.toThrow("todavía no empieza");
    expect(h.pasarAlAhorro).not.toHaveBeenCalled();
  });

  it("validates the input: an amount of zero or a broken month is a message, not a crash", async () => {
    conCapacidades("VER", "ANOTAR");
    expect(await pasarCierreAlAhorroAction({ ...CIERRE, monto: "0" })).toMatchObject({ ok: false });
    expect(await pasarCierreAlAhorroAction({ ...CIERRE, mes: "noviembre" })).toMatchObject({ ok: false, mensaje: "El mes no es válido (AAAA-MM)." });
  });

  it("an unexpected failure is logged and answered with a generic message", async () => {
    conCapacidades("VER", "ANOTAR");
    h.pasarAlAhorro.mockRejectedValueOnce(new Error("connection reset"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await pasarCierreAlAhorroAction(CIERRE)).toEqual({ ok: false, mensaje: "No se pudo guardar. Intenta de nuevo en un momento." });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("Guardar arqueo", () => {
  const input = {
    operationKey: "6f1c2b9a-0000-4000-8000-0000000000aa",
    conteos: [{ cuentaId: "nequi", contado: "1550000" }],
  };

  it("only people with `contar` may save; nothing is written otherwise", async () => {
    conCapacidades("VER", "ANOTAR", "CONFIGURAR");
    const r = await guardarArqueoAction(input);
    expect(r).toEqual({ ok: false, mensaje: "No tienes permiso para guardar arqueos." });
    expect(h.prisma.cnArqueo.findUnique).not.toHaveBeenCalled();
    expect(h.tx.cnArqueo.create).not.toHaveBeenCalled();
  });

  it("saves only the counted accounts, with «Lopest dice» computed on the server", async () => {
    conCapacidades("VER", "CONTAR");
    h.prisma.cnArqueo.findUnique.mockResolvedValue(null);
    h.saldo.valor = 1_600_000;
    h.tx.cnCuenta.findMany.mockResolvedValue([
      { id: "nequi", nombre: "Nequi", archivada: false, saldoInicial: "1600000.00", fechaSaldoInicial: AHORA },
    ]);
    h.tx.cnArqueo.create.mockResolvedValue({ id: "arq-1", fecha: AHORA });
    const r = await guardarArqueoAction(input);
    expect(r).toMatchObject({ ok: true, mensaje: "Arqueo guardado: 0 de 1 cuadran." });
    const data = h.tx.cnArqueo.create.mock.calls[0][0].data;
    expect(data.detalles.create).toHaveLength(1);
    expect(data.detalles.create[0]).toMatchObject({ cuentaId: "nequi" });
    expect(Number(data.detalles.create[0].diferencia)).toBe(-50_000);
  });

  it("a repeated operation key returns the arqueo already saved", async () => {
    conCapacidades("VER", "CONTAR");
    h.prisma.cnArqueo.findUnique.mockResolvedValue({
      id: "arq-1",
      detalles: [{ cuentaId: "nequi", saldoSistema: "1600000", contado: "1550000", diferencia: "-50000" }],
    });
    const r = await guardarArqueoAction(input);
    expect(r).toMatchObject({ ok: true, mensaje: "Este arqueo ya estaba guardado." });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("an empty arqueo is refused by validation", async () => {
    conCapacidades("VER", "CONTAR");
    expect(await guardarArqueoAction({ ...input, conteos: [] })).toEqual({ ok: false, mensaje: "Cuenta al menos una cuenta." });
  });
});
