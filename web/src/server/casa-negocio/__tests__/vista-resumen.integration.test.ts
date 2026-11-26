/**
 * Resumen vs Reportes against a real PostgreSQL: the actual SQL of
 * `getHistoricoRecaudacion` / `getProyeccionCartera` and the Resumen loader
 * read the same rows, for an ADMIN (every owner) and for an operator (own
 * loans only). Every month of the Resumen window must match to the cent.
 *
 * Skipped unless CN_TEST_DATABASE_URL points at a THROWAWAY database whose
 * name contains "test" (same guard and recipe as casa-negocio.integration).
 * Run it on its own: the ADMIN comparison reads every loan in the database,
 * so another suite writing loans at the same moment would race it.
 *
 *   CN_TEST_DATABASE_URL=postgresql://…/cn_test pnpm exec vitest run vista-resumen.integration
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_PRUEBA = process.env.CN_TEST_DATABASE_URL;

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return {
    prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.CN_TEST_DATABASE_URL ?? "postgresql://invalid" }) }),
  };
});
vi.mock("@/server/auth/guards", () => ({
  requireUser: async () => {
    throw new Error("no se usa aquí");
  },
  hasRole: (user: { roles: string[] }, role: string) => user.roles.includes(role),
}));

import { getHistoricoRecaudacion, getProyeccionCartera } from "@/features/analytics/queries";
import { prisma } from "@/lib/prisma";

import { cargarVistaResumen, MESES_PROYECCION } from "../vista-resumen";

const run = randomUUID().slice(0, 8);
const ADMIN = { id: `radmin_${run}`, nombre: "Padre", roles: ["ADMIN"] };
const OPERADOR = { id: `roper_${run}`, nombre: "Daniel", roles: ["OPERADOR"] };
const AHORA = new Date("2026-11-25T17:00:00.000Z");
const dia = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);
const cents = (n: number) => Math.round(n * 100);

const lector = (u: typeof ADMIN) => ({ ...u, roles: u.roles as never, capacidades: new Set(["VER" as const]) });

async function comparar(user: typeof ADMIN) {
  const [vista, historico, proyeccion] = await Promise.all([
    cargarVistaResumen(prisma, lector(user), 12, AHORA),
    getHistoricoRecaudacion({ id: user.id, roles: user.roles as never }),
    getProyeccionCartera({ id: user.id, roles: user.roles as never }),
  ]);
  const h = new Map(historico.map((m) => [m.mesStr, m]));
  const p = new Map(proyeccion.map((m) => [m.mesStr, m]));
  return { vista, h, p };
}

describe.skipIf(!URL_PRUEBA)("Resumen contra Reportes en PostgreSQL", () => {
  beforeAll(async () => {
    const nombreDb = new URL(URL_PRUEBA!).pathname.slice(1);
    if (!nombreDb.includes("test")) throw new Error(`Base "${nombreDb}" no parece desechable; se aborta.`);
    await prisma.$executeRawUnsafe(`DELETE FROM "creditos" WHERE "codigo" LIKE 'LP-R-%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "clientes" WHERE "cedula" LIKE 'cedr_%'`);
    await prisma.user.createMany({
      data: [ADMIN, OPERADOR].map((u) => ({ id: u.id, email: `${u.id}@test.invalid`, nombre: u.nombre })),
    });
    const cliente = await prisma.cliente.create({ data: { cedula: `cedr_${run}`, nombre: "Cliente Resumen", ownerUserId: ADMIN.id } });

    let n = 0;
    const credito = async (owner: string, eliminado = false) =>
      prisma.credito.create({
        data: {
          codigo: `LP-R-${run}-${(n += 1)}`,
          clienteId: cliente.id,
          ownerUserId: owner,
          fechaPrestamo: dia("2025-08-01"),
          monto: "20000000.00",
          plazoMeses: "24",
          tasaMensual: "0.03",
          frecuencia: "MENSUAL",
          ...(eliminado ? { eliminadoEn: dia("2026-01-01"), motivoEliminacion: "prueba" } : {}),
        },
      });
    const deAdmin = await credito(ADMIN.id);
    const deOperador = await credito(OPERADOR.id);
    const borrado = await credito(OPERADOR.id, true);

    let k = 0;
    const evento = (creditoId: string, data: Record<string, unknown>) =>
      prisma.eventoFinanciero.create({
        data: {
          codigo: `EVR-${run}-${(k += 1)}`,
          creditoId,
          numeroCuota: k,
          valorProgramado: "1333333.43",
          capitalProgramado: "1000000.10",
          interesProgramado: "333333.33",
          ...data,
        },
      });

    for (let i = 0; i < 20; i += 1) {
      const f = new Date(Date.UTC(2025, 9 + i, 10, 5)); // Oct-2025 .. May-2027
      const pagada = f < dia("2026-11-01");
      for (const c of [deAdmin, deOperador, borrado]) {
        await evento(
          c.id,
          pagada
            ? { fechaProgramada: f, fechaPago: f, estado: "PAGADO", montoPagado: "1333333.43", capitalPagado: "1000000.10", interesPagado: "333333.33" }
            : { fechaProgramada: f, estado: i % 5 === 0 ? "ATRASADO" : "PENDIENTE" },
        );
      }
    }
    // Legacy payment without split, a partial payment ahead, an abono, an overdue cuota.
    await evento(deOperador.id, { fechaProgramada: dia("2026-04-15"), fechaPago: dia("2026-04-18"), estado: "PAGADO", montoPagado: "650000.00", capitalProgramado: "500000.00", interesProgramado: "150000.00" });
    await evento(deOperador.id, { fechaProgramada: dia("2027-01-15"), estado: "PENDIENTE", capitalPagado: "100000.55", interesPagado: "20000.00" });
    await evento(deAdmin.id, { tipo: "ABONO_CAPITAL", fechaProgramada: dia("2026-08-05"), fechaPago: dia("2026-08-05"), estado: "PAGADO", montoPagado: "2000000.00", capitalProgramado: "0", interesProgramado: "0", valorProgramado: "0" });
    await evento(deAdmin.id, { fechaProgramada: dia("2026-07-15"), estado: "MORA" });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "creditos" WHERE "codigo" LIKE 'LP-R-${run}-%'`);
    await prisma.$disconnect();
  });

  for (const user of [ADMIN, OPERADOR]) {
    it(`cada mes coincide con Reportes para ${user.roles[0]}`, async () => {
      const { vista, h, p } = await comparar(user);
      const historia = vista.cobros.meses.filter((m) => !m.proyectado);
      expect(historia).toHaveLength(12);
      let total = 0;
      for (const m of historia) {
        const r = h.get(m.mes) ?? { capital: 0, interes: 0, total: 0 };
        expect([cents(m.capital), cents(m.interes)], m.mes).toEqual([cents(r.capital), cents(r.interes)]);
        total += cents(r.total);
      }
      expect(cents(vista.cobros.cobrado)).toBe(total);

      const futuros = vista.cobros.meses.filter((m) => m.proyectado);
      expect(futuros).toHaveLength(MESES_PROYECCION);
      let viene = 0;
      for (const m of futuros) {
        const r = p.get(m.mes) ?? { capital: 0, interes: 0, total: 0 };
        expect([cents(m.capital), cents(m.interes)], m.mes).toEqual([cents(r.capital), cents(r.interes)]);
        viene += cents(r.total);
      }
      expect(cents(vista.cobros.viene)).toBe(viene);
    });
  }

  it("el operador no ve los créditos del padre ni los borrados", async () => {
    const { vista } = await comparar(OPERADOR);
    // One live loan: 1.333.333,43 per month, plus the legacy payment in April.
    const oct = vista.cobros.meses.find((m) => m.mes === "2026-10")!;
    expect(oct.total).toBeCloseTo(1_333_333.43, 2);
    expect(vista.cobros.meses.find((m) => m.mes === "2026-04")!.total).toBeCloseTo(1_333_333.43 + 650_000, 2);
  });
});
