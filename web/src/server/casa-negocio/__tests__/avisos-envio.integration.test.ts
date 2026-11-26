/**
 * The Telegram avisos digest against a real PostgreSQL: the month read, the
 * engine, the on/off switches of Configuración and the dedupe table together.
 *
 * Skipped unless CN_TEST_DATABASE_URL points at a THROWAWAY database whose
 * name contains "test" (same guard and recipe as
 * `casa-negocio.integration.test.ts`). Run it ALONE: it wipes the cn_* tables
 * the other integration files also use.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_PRUEBA = process.env.CN_TEST_DATABASE_URL;

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.CN_TEST_DATABASE_URL ?? "postgresql://invalid" }) }),
  };
});

import { prisma } from "@/lib/prisma";

import { avisosNuevosDelDia } from "../avisos-envio";

/** Bogota midnight of a day, as the app stores days. */
const dia = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);
/** Mid-morning in Bogota, when the n8n schedule fires. */
const manana = (fecha: string) => new Date(`${fecha}T12:00:00.000Z`);
const codigos = (r: Awaited<ReturnType<typeof avisosNuevosDelDia>>) => r.nuevos.map((a) => a.codigo).sort();

describe.skipIf(!URL_PRUEBA)("Avisos a Telegram contra PostgreSQL", () => {
  let arriendoId = "";

  beforeAll(async () => {
    const nombreDb = new URL(URL_PRUEBA!).pathname.slice(1);
    if (!nombreDb.includes("test")) throw new Error(`Base "${nombreDb}" no parece desechable; se aborta.`);

    for (const sql of [
      `DELETE FROM "cn_avisos_enviados"`,
      `DELETE FROM "cn_arqueo_detalles"`,
      `DELETE FROM "cn_arqueos"`,
      `DELETE FROM "cn_asignaciones_cuenta"`,
      `DELETE FROM "cn_movimientos"`,
      `DELETE FROM "cn_castigos_credito"`,
      `UPDATE "cn_configuracion" SET "cuentaAhorroId" = NULL, "metaAhorro" = NULL, "metaAsignacionCasa" = NULL`,
      `DELETE FROM "cn_categorias_gasto"`,
      `DELETE FROM "cn_cuentas"`,
      `UPDATE "cn_reglas_aviso" SET "activa" = true`,
    ]) {
      await prisma.$executeRawUnsafe(sql);
    }

    await prisma.cnCuenta.create({
      data: { nombre: "Efectivo", grupo: "NEGOCIO", tipo: "EFECTIVO", saldoInicial: "500000", fechaSaldoInicial: dia("2026-12-01") },
    });
    await prisma.cnCuenta.create({
      data: { nombre: "Cuenta casa", grupo: "CASA", tipo: "BANCO", saldoInicial: "3000000", fechaSaldoInicial: dia("2026-12-01") },
    });
    const arriendo = await prisma.cnCategoriaGasto.create({
      data: { nombre: "Arriendo", clase: "FIJO", monto: "1787000", periodicidad: "MENSUAL", diaPago: 17 },
    });
    arriendoId = arriendo.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("antes del 1-dic no evalúa ni registra nada", async () => {
    const r = await avisosNuevosDelDia(prisma, { ahora: manana("2026-11-30") });
    expect(r).toMatchObject({ estado: "sin-modulo", nuevos: [], mensaje: null });
    expect(await prisma.cnAvisoEnviado.count()).toBe(0);
  });

  it("el primer día con avisos los reporta; al día siguiente no los repite", async () => {
    const primero = await avisosNuevosDelDia(prisma, { ahora: manana("2026-12-18"), urlModulo: "https://lopest.test/casa-negocio" });
    expect(codigos(primero)).toEqual(expect.arrayContaining(["CUENTA_SIN_CONTAR", "FIJO_VENCIDO_SIN_PAGAR"]));
    expect(primero.mensaje).toContain("Arriendo sin pagar");
    expect(primero.mensaje).toContain("https://lopest.test/casa-negocio");

    const segundo = await avisosNuevosDelDia(prisma, { ahora: manana("2026-12-19") });
    expect(segundo.nuevos).toEqual([]);
    expect(segundo.mensaje).toBeNull();
  });

  it("una regla apagada en Configuración no se envía y su aviso queda resuelto", async () => {
    await prisma.cnReglaAviso.update({ where: { codigo: "CUENTA_SIN_CONTAR" }, data: { activa: false } });
    const r = await avisosNuevosDelDia(prisma, { ahora: manana("2026-12-20") });
    expect(codigos(r)).not.toContain("CUENTA_SIN_CONTAR");
    const fila = await prisma.cnAvisoEnviado.findFirstOrThrow({ where: { codigo: "CUENTA_SIN_CONTAR" } });
    expect(fila.resueltoEn).not.toBeNull();

    // Switched back on, it is news again.
    await prisma.cnReglaAviso.update({ where: { codigo: "CUENTA_SIN_CONTAR" }, data: { activa: true } });
    const otraVez = await avisosNuevosDelDia(prisma, { ahora: manana("2026-12-21") });
    expect(codigos(otraVez)).toContain("CUENTA_SIN_CONTAR");
  });

  it("pagar el fijo lo resuelve; dos corridas simultáneas no lo reportan dos veces", async () => {
    await prisma.cnMovimiento.create({
      data: {
        tipo: "GASTO_FIJO",
        fecha: dia("2026-12-21"),
        monto: "1787000",
        cuentaOrigenId: (await prisma.cnCuenta.findUniqueOrThrow({ where: { nombre: "Cuenta casa" } })).id,
        categoriaId: arriendoId,
        accionPor: "prueba",
      },
    });
    await avisosNuevosDelDia(prisma, { ahora: manana("2026-12-22") });
    const arriendo = await prisma.cnAvisoEnviado.findFirstOrThrow({ where: { codigo: "FIJO_VENCIDO_SIN_PAGAR" } });
    expect(arriendo.resueltoEn).not.toBeNull();

    // A new month: the same unpaid rent in January is a new fact. Two runs
    // overlap (a manual retry while the schedule fires): one message only.
    const [a, b] = await Promise.all([
      avisosNuevosDelDia(prisma, { ahora: manana("2027-01-18") }),
      avisosNuevosDelDia(prisma, { ahora: manana("2027-01-18") }),
    ]);
    const fijos = [...a.nuevos, ...b.nuevos].filter((n) => n.codigo === "FIJO_VENCIDO_SIN_PAGAR");
    expect(fijos).toHaveLength(1);
  });
});
