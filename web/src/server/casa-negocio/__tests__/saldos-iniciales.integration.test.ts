/**
 * Launch scenario of docs/estado/lanzamiento-casa-negocio.md, step "saldos
 * iniciales", against a real PostgreSQL: the accounts exist with balance 0
 * (as the seed leaves them), the father types each real balance dated 1-dic
 * in Configuración through the same Server Action the form calls, sees it in
 * the view, corrects a typo later, and the mother (only `ver`) cannot.
 *
 * The web container runs in UTC in production, so the action runs here with
 * TZ=UTC too: the 1-dic date must still be stored as Bogota midnight.
 *
 * Skipped unless CN_TEST_DATABASE_URL points at a THROWAWAY database whose
 * name contains "test" (same guard as the other integration files). Run it
 * ALONE: it wipes the cn_* tables.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_PRUEBA = process.env.CN_TEST_DATABASE_URL;

const sesion = vi.hoisted(() => ({ user: null as null | { id: string; nombre: string; roles: string[] } }));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.CN_TEST_DATABASE_URL ?? "postgresql://invalid" }) }),
  };
});
vi.mock("@/server/auth/guards", () => ({
  requireUser: async () => {
    if (!sesion.user) throw new Error("sin sesión");
    return { ...sesion.user, email: "", image: null, roleNames: [] };
  },
  hasRole: (user: { roles: string[] }, role: string) => user.roles.includes(role),
}));

import { editarCuentaAction } from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { prisma } from "@/lib/prisma";

import { capacidadesDe } from "../capacidades";
import { cargarVistaConfiguracion } from "../vista-configuracion";

const run = randomUUID().slice(0, 8);
const PADRE = { id: `padre_saldos_${run}`, nombre: "Padre", roles: ["ADMIN"] };
const MADRE = { id: `madre_saldos_${run}`, nombre: "Madre", roles: ["LECTURA"] };
const TZ_ORIGINAL = process.env.TZ;

async function vista() {
  return cargarVistaConfiguracion(prisma, { id: PADRE.id, capacidades: await capacidadesDe(prisma, PADRE.id) });
}

/** The fields the Configuración form posts for an account, as strings. */
async function formulario(nombre: string, saldoInicial: string) {
  const cuenta = (await vista()).cuentas.find((c) => c.nombre === nombre)!;
  return {
    cuentaId: cuenta.id,
    version: cuenta.version,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo,
    orden: String(cuenta.orden),
    saldoInicial,
    fechaSaldoInicial: "2026-12-01",
  };
}

describe.skipIf(!URL_PRUEBA)("Saldos iniciales del arranque contra PostgreSQL", () => {
  beforeAll(async () => {
    const nombreDb = new URL(URL_PRUEBA!).pathname.slice(1);
    if (!nombreDb.includes("test")) throw new Error(`Base "${nombreDb}" no parece desechable; se aborta.`);
    process.env.TZ = "UTC";

    for (const sql of [
      `DELETE FROM "cn_avisos_enviados"`,
      `DELETE FROM "cn_arqueo_detalles"`,
      `DELETE FROM "cn_arqueos"`,
      `DELETE FROM "cn_asignaciones_cuenta"`,
      `DELETE FROM "cn_movimientos"`,
      `DELETE FROM "cn_castigos_credito"`,
      `UPDATE "cn_configuracion" SET "cuentaAhorroId" = NULL`,
      `DELETE FROM "cn_categorias_gasto"`,
      `DELETE FROM "cn_cuentas"`,
    ]) {
      await prisma.$executeRawUnsafe(sql);
    }
    await prisma.user.createMany({
      data: [
        { id: PADRE.id, email: `${PADRE.id}@test.invalid`, nombre: PADRE.nombre },
        { id: MADRE.id, email: `${MADRE.id}@test.invalid`, nombre: MADRE.nombre },
      ],
    });
    await prisma.cnPermiso.createMany({
      data: [
        ...(["VER", "ANOTAR", "CONTAR", "CONFIGURAR"] as const).map((capacidad) => ({ userId: PADRE.id, capacidad })),
        { userId: MADRE.id, capacidad: "VER" as const },
      ],
    });
    // What the seed leaves: accounts opened on 1-dic with no real balance yet.
    const apertura = new Date("2026-12-01T05:00:00.000Z");
    await prisma.cnCuenta.createMany({
      data: [
        { nombre: "Efectivo", grupo: "NEGOCIO", tipo: "EFECTIVO", saldoInicial: "0", fechaSaldoInicial: apertura, orden: 1 },
        { nombre: "Cuenta casa", grupo: "CASA", tipo: "BANCO", saldoInicial: "0", fechaSaldoInicial: apertura, orden: 1 },
      ],
    });
  });

  afterAll(async () => {
    if (TZ_ORIGINAL === undefined) delete process.env.TZ;
    else process.env.TZ = TZ_ORIGINAL;
    await prisma.$disconnect();
  });

  it("el padre pone el saldo real con fecha 1-dic y lo ve en Configuración", async () => {
    sesion.user = PADRE;
    const r = await editarCuentaAction(await formulario("Efectivo", "1.250.000"));
    expect(r).toEqual({ ok: true });

    const efectivo = (await vista()).cuentas.find((c) => c.nombre === "Efectivo")!;
    expect(efectivo.saldoInicial).toBe(1250000);
    expect(efectivo.fechaSaldoInicial).toBe("2026-12-01");
    const fila = await prisma.cnCuenta.findUniqueOrThrow({ where: { nombre: "Efectivo" } });
    expect(fila.fechaSaldoInicial.toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("corrige un error después, y la auditoría guarda el antes y el después", async () => {
    sesion.user = PADRE;
    expect(await editarCuentaAction(await formulario("Efectivo", "1.205.000"))).toEqual({ ok: true });
    expect((await vista()).cuentas.find((c) => c.nombre === "Efectivo")!.saldoInicial).toBe(1205000);

    const cuenta = await prisma.cnCuenta.findUniqueOrThrow({ where: { nombre: "Efectivo" } });
    const auditoria = await prisma.auditLog.findMany({ where: { entityId: cuenta.id, actorId: PADRE.id }, orderBy: { creadoEn: "asc" } });
    expect(auditoria).toHaveLength(2);
  });

  it("un formulario viejo (otra pestaña abierta) no pisa la corrección", async () => {
    sesion.user = PADRE;
    const viejo = await formulario("Cuenta casa", "3.000.000");
    expect(await editarCuentaAction(viejo)).toEqual({ ok: true });
    const r = await editarCuentaAction({ ...viejo, saldoInicial: "9.999.999" });
    expect(r.ok).toBe(false);
    expect((await vista()).cuentas.find((c) => c.nombre === "Cuenta casa")!.saldoInicial).toBe(3000000);
  });

  it("la madre, que solo puede ver, no puede cambiar saldos", async () => {
    sesion.user = MADRE;
    const r = await editarCuentaAction(await formulario("Efectivo", "1"));
    expect(r.ok).toBe(false);
    expect((await prisma.cnCuenta.findUniqueOrThrow({ where: { nombre: "Efectivo" } })).saldoInicial.toString()).toBe("1205000");
  });
});
