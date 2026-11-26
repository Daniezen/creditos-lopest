/**
 * The Configuración read against a real PostgreSQL: grouped counts decide
 * delete vs archive, balances include movements, people come with their
 * capabilities. Same guard and recipe as casa-negocio.integration.test.ts
 * (skipped unless CN_TEST_DATABASE_URL names a throwaway "test" database).
 *
 * Run it ALONE (`vitest run vista-configuracion.integration`): both files wipe
 * the same cn_* tables, so running them in parallel against one database makes
 * them see each other's users and configurators.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_PRUEBA = process.env.CN_TEST_DATABASE_URL;
const sesion = vi.hoisted(() => ({ user: null as null | { id: string; nombre: string; roles: string[] } }));

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

import { prisma } from "@/lib/prisma";

import { capacidadesDe } from "../capacidades";
import { archivarCuenta, crearCategoria, crearCuenta, definirCapacidades, editarCategoria, eliminarCuenta } from "../configuracion";
import { CasaNegocioReglaError } from "../errors";
import { registrarMovimiento } from "../movimientos";
import { cargarVistaConfiguracion } from "../vista-configuracion";

const run = randomUUID().slice(0, 8);
const PADRE = { id: `padre_${run}`, nombre: "Padre Lopera", roles: ["ADMIN"] };
const MADRE = { id: `madre_${run}`, nombre: "Madre", roles: ["LECTURA"] };

describe.skipIf(!URL_PRUEBA)("Vista de Configuración contra PostgreSQL", () => {
  beforeAll(async () => {
    const nombreDb = new URL(URL_PRUEBA!).pathname.slice(1);
    if (!nombreDb.includes("test")) throw new Error(`Base "${nombreDb}" no parece desechable; se aborta.`);
    for (const sql of [
      `DELETE FROM "cn_arqueo_detalles"`,
      `DELETE FROM "cn_arqueos"`,
      `DELETE FROM "cn_asignaciones_cuenta"`,
      `DELETE FROM "cn_movimientos"`,
      `DELETE FROM "cn_permisos"`,
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
    sesion.user = PADRE;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("separa borrar de archivar, cuenta movimientos por gasto y lista personas", async () => {
    const { cuentaId: casa } = await crearCuenta({ nombre: `Casa ${run}`, grupo: "CASA", tipo: "BANCO", saldoInicial: "1.000.000", fechaSaldoInicial: "2026-11-01" });
    const { cuentaId: vacia } = await crearCuenta({ nombre: `Vacía ${run}`, grupo: "NEGOCIO", tipo: "EFECTIVO", saldoInicial: "0", fechaSaldoInicial: "2026-11-01" });
    const { categoriaId } = await crearCategoria({ nombre: `Mercado ${run}`, clase: "VARIABLE", monto: "2.700.000", periodicidad: "MENSUAL" });
    await registrarMovimiento({
      operationKey: randomUUID(),
      tipo: "GASTO_VARIABLE",
      fecha: "2026-11-10",
      monto: "100.000",
      cuentaOrigenId: casa,
      categoriaId,
    });

    const vista = await cargarVistaConfiguracion(prisma, { id: PADRE.id, capacidades: await capacidadesDe(prisma, PADRE.id) });
    const cCasa = vista.cuentas.find((c) => c.id === casa)!;
    const cVacia = vista.cuentas.find((c) => c.id === vacia)!;
    expect(cCasa).toMatchObject({ tieneMovimientos: true, saldoActual: 900_000 });
    expect(cVacia.tieneMovimientos).toBe(false);
    expect(vista.gastos.find((g) => g.id === categoriaId)).toMatchObject({ movimientos: 1, monto: 2_700_000 });
    expect(vista.avisos).toHaveLength(10);
    expect(vista.puedeConfigurar).toBe(true);
    expect(vista.personas.find((p) => p.userId === PADRE.id)).toMatchObject({ esUsted: true, iniciales: "PL" });

    // Con movimientos no se borra; sin ellos sí.
    await expect(eliminarCuenta({ cuentaId: casa, version: cCasa.version })).rejects.toBeInstanceOf(CasaNegocioReglaError);
    await eliminarCuenta({ cuentaId: vacia, version: cVacia.version });
    expect(await prisma.cnCuenta.findUnique({ where: { id: vacia } })).toBeNull();

    // Pasar el sobre a fijos conserva su movimiento, ahora como gasto fijo.
    const gasto = vista.gastos.find((g) => g.id === categoriaId)!;
    await editarCategoria({
      categoriaId,
      version: gasto.version,
      nombre: gasto.nombre,
      clase: "FIJO",
      monto: "2.700.000",
      periodicidad: "MENSUAL",
      diaPago: "",
      activa: "true",
    });
    expect(await prisma.cnMovimiento.count({ where: { categoriaId, tipo: "GASTO_FIJO" } })).toBe(1);

    // Archivar exige saldo cero.
    await expect(archivarCuenta({ cuentaId: casa, version: cCasa.version, archivada: "true" })).rejects.toThrow(/saldo/);
  });

  it("la vista de quien solo ve no habilita edición y el último configurador está protegido", async () => {
    const vista = await cargarVistaConfiguracion(prisma, { id: MADRE.id, capacidades: await capacidadesDe(prisma, MADRE.id) });
    expect(vista.puedeConfigurar).toBe(false);
    await expect(definirCapacidades({ userId: PADRE.id, capacidades: ["VER"] })).rejects.toThrow(/Alguien tiene que poder configurar/);
  });
});
