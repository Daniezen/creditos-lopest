/**
 * The December/January story of `mundo.fixture.ts`, replayed through the REAL
 * services (crearCuenta, registrarMovimiento, asignarCuenta, registrarCastigo,
 * guardarArqueo, pasarCierreAlAhorro, editarMovimiento, revertirCastigo) on a
 * real PostgreSQL, then read back with `cargarCasaNegocioMes` and the tabs.
 *
 * Two things are checked:
 *   1. the real read and the pure mirror (`leerMes`) agree field by field, so
 *      the pure e2e suites prove what production computes;
 *   2. the same hand-written figures as the pure suites.
 *
 * Skipped unless CN_TEST_DATABASE_URL points at a THROWAWAY database whose
 * name contains "test" (same guard and recipe as casa-negocio.integration):
 *
 *   docker run --rm -d --name cn-test-pg -e POSTGRES_USER=lopest_admin \
 *     -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=cn_test -p 127.0.0.1:55432:5432 postgres:18.4-alpine
 *   DATABASE_URL=postgresql://lopest_admin:pw@127.0.0.1:55432/cn_test pnpm exec prisma migrate deploy
 *   CN_TEST_DATABASE_URL=postgresql://lopest_admin:pw@127.0.0.1:55432/cn_test pnpm exec vitest run e2e/db.integration
 *
 * It wipes the cn_* tables, so run it alone (not in parallel with the other
 * integration files against the same database).
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_PRUEBA = process.env.CN_TEST_DATABASE_URL;
// The form parsers store a day as LOCAL midnight (`new Date(y, m, d)` in
// `server/validation/input.ts`), which is Bogota midnight only because the
// containers run with TZ=America/Bogota. Run like production; on a host in
// another zone every date would land one day early.
vi.hoisted(() => {
  process.env.TZ = "America/Bogota";
});
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
import type { CasaNegocioMes } from "@/features/casa-negocio/types";

import { guardarArqueo } from "../../arqueos";
import { asignarCuenta } from "../../asignaciones";
import { capacidadesDe } from "../../capacidades";
import { registrarCastigo, revertirCastigo } from "../../castigos";
import { crearCategoria, crearCuenta, editarConfiguracion } from "../../configuracion";
import { anularMovimiento, editarMovimiento, registrarMovimiento } from "../../movimientos";
import { cargarCasaNegocioMes } from "../../queries";
import { construirVistaAhorro, leerCierresAhorro, pasarCierreAlAhorro } from "../../vista-ahorro";
import { evaluarMes } from "../../vista-mes";
import { cargarVistaResumen } from "../../vista-resumen";

import { cierresDe, dia, leerMes, local, mundoBase, type Mundo } from "./mundo.fixture";

const run = randomUUID().slice(0, 8);
const PADRE = { id: `padre_e2e_${run}`, nombre: "Padre", roles: ["ADMIN"] };
const E02 = local("2027-01-02", "09:00");
const E20 = local("2027-01-20", "12:00");

/** «1.200.000», as the forms send money. */
const texto = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 }).replace(/,/g, ".");
const key = () => randomUUID();

describe.skipIf(!URL_PRUEBA)("Casa y Negocio de punta a punta contra PostgreSQL", () => {
  const mundo: Mundo = mundoBase();
  /** World id → database id (accounts, categories, credits, events, movements). */
  const id = new Map<string, string>();
  const db = (w: string) => id.get(w)!;
  let lector: Parameters<typeof cargarCasaNegocioMes>[1];

  beforeAll(async () => {
    const nombreDb = new URL(URL_PRUEBA!).pathname.slice(1);
    if (!nombreDb.includes("test")) throw new Error(`Base "${nombreDb}" no parece desechable; se aborta.`);
    // The services refuse dates after «today»: live in January 2027. Only
    // `Date` is faked, so the database driver's timers keep working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(E20);
    for (const sql of [
      `DELETE FROM "cn_arqueo_detalles"`,
      `DELETE FROM "cn_arqueos"`,
      `DELETE FROM "cn_asignaciones_cuenta"`,
      `DELETE FROM "cn_movimientos"`,
      `DELETE FROM "cn_castigos_credito"`,
      `DELETE FROM "cn_permisos"`,
      `UPDATE "cn_configuracion" SET "cuentaAhorroId" = NULL, "metaAhorro" = NULL, "metaAsignacionCasa" = NULL`,
      `UPDATE "cn_reglas_aviso" SET "activa" = true, "umbral" = NULL`,
      `DELETE FROM "cn_categorias_gasto"`,
      `DELETE FROM "cn_cuentas"`,
      `DELETE FROM "creditos" WHERE "codigo" LIKE 'LP-T-%'`,
      `DELETE FROM "clientes" WHERE "cedula" LIKE 'ced_%'`,
    ]) {
      await prisma.$executeRawUnsafe(sql);
    }
    await prisma.user.create({ data: { id: PADRE.id, email: `${PADRE.id}@test.invalid`, nombre: PADRE.nombre } });
    await prisma.cnPermiso.createMany({
      data: (["VER", "ANOTAR", "CONTAR", "CONFIGURAR"] as const).map((capacidad) => ({ userId: PADRE.id, capacidad })),
    });
    sesion.user = PADRE;
    lector = { ...PADRE, roles: PADRE.roles as never, capacidades: await capacidadesDe(prisma, PADRE.id) };

    // --- Configuración -------------------------------------------------------
    for (const c of mundo.cuentas) {
      const r = await crearCuenta({ nombre: c.nombre, grupo: c.grupo, tipo: c.tipo, saldoInicial: texto(c.saldoInicial), fechaSaldoInicial: c.fechaSaldoInicial });
      id.set(c.id, r.cuentaId);
    }
    for (const c of mundo.categorias) {
      const r = await crearCategoria({
        nombre: c.nombre,
        clase: c.clase,
        monto: c.monto === null ? undefined : texto(c.monto),
        periodicidad: c.periodicidad,
        mesAnual: c.mesAnual === null ? undefined : String(c.mesAnual),
        diaPago: c.diaPago === null ? undefined : String(c.diaPago),
      });
      id.set(c.id, r.categoriaId);
    }
    const config = await prisma.cnConfiguracion.findUniqueOrThrow({ where: { id: "default" } });
    await editarConfiguracion({ version: config.actualizadoEn.toISOString(), cuentaAhorroId: db("nu"), metaAhorro: texto(mundo.metaAhorro!) });

    // --- Créditos (their own tables, written as Créditos writes them) --------
    const cliente = await prisma.cliente.create({ data: { cedula: `ced_e2e_${run}`, nombre: "Cliente", ownerUserId: PADRE.id } });
    for (const c of mundo.creditos) {
      const cr = await prisma.credito.create({
        data: {
          codigo: `LP-T-${run}-${c.codigo}`,
          clienteId: cliente.id,
          ownerUserId: PADRE.id,
          fechaPrestamo: dia(c.fechaPrestamo),
          monto: String(c.monto),
          plazoMeses: "6",
          tasaMensual: "0.05",
          frecuencia: "MENSUAL",
        },
      });
      id.set(c.id, cr.id);
    }
    for (const e of mundo.eventos) {
      const ev = await prisma.eventoFinanciero.create({
        data: {
          codigo: `EV-${run}-${e.id}`,
          creditoId: db(e.creditoId),
          tipo: e.tipo,
          numeroCuota: e.numeroCuota,
          fechaProgramada: dia(e.fechaProgramada),
          valorProgramado: String(e.capitalProgramado + e.interesProgramado),
          capitalProgramado: String(e.capitalProgramado),
          interesProgramado: String(e.interesProgramado),
          ...(e.pago
            ? {
                estado: "PAGADO" as const,
                fechaPago: e.pago.en,
                montoPagado: String(e.pago.capital + e.pago.interes),
                capitalPagado: String(e.pago.capital),
                interesPagado: String(e.pago.interes),
                saldoCapitalPost: String(e.pago.saldoCapitalPost),
              }
            : { estado: e.estadoPendiente ?? ("PENDIENTE" as const) }),
        },
      });
      id.set(e.id, ev.id);
    }

    // --- The month, in the order it happened ---------------------------------
    // Order matters only for the arqueo: its «Lopest dice» is computed by the
    // server from everything recorded at that moment.
    type Paso = { cuando: string; hacer: () => Promise<unknown> };
    const pasos: Paso[] = [];
    for (const m of mundo.movimientos) {
      if (m.clave) continue; // the cierre goes through «Pasar al ahorro» below
      pasos.push({
        cuando: `${m.fecha}T12`,
        hacer: async () => {
          const r = await registrarMovimiento({
            operationKey: key(),
            tipo: m.tipo,
            fecha: m.fecha,
            monto: texto(m.monto),
            cuentaOrigenId: m.origen ? db(m.origen) : undefined,
            cuentaDestinoId: m.destino ? db(m.destino) : undefined,
            categoriaId: m.categoria ? db(m.categoria) : undefined,
            nota: m.nota,
          });
          id.set(m.id, r.movimientoId);
          if (m.anulado) {
            const row = await prisma.cnMovimiento.findUniqueOrThrow({ where: { id: r.movimientoId } });
            await anularMovimiento({ movimientoId: row.id, version: row.actualizadoEn.toISOString(), motivo: "Duplicado" });
          }
        },
      });
    }
    for (const c of mundo.creditos.filter((x) => x.cuentaId)) {
      pasos.push({ cuando: `${c.fechaPrestamo}T11`, hacer: () => asignarCuenta({ creditoId: db(c.id), cuentaId: db(c.cuentaId!) }) });
    }
    for (const e of mundo.eventos.filter((x) => x.cuentaId && x.pago)) {
      const fecha = e.pago!.en.toISOString().slice(0, 10);
      pasos.push({ cuando: `${fecha}T13`, hacer: () => asignarCuenta({ eventoFinancieroId: db(e.id), cuentaId: db(e.cuentaId!) }) });
    }
    for (const c of mundo.castigos) {
      pasos.push({
        cuando: `${c.fecha}T14`,
        hacer: async () => id.set(c.id, (await registrarCastigo({ creditoId: db(c.creditoId), monto: texto(c.monto), fecha: c.fecha, motivo: c.motivo })).castigoId),
      });
    }
    for (const a of mundo.arqueos) {
      pasos.push({
        cuando: `${a.fecha.slice(0, 10)}T18`,
        hacer: async () => {
          const r = await guardarArqueo({ operationKey: key(), conteos: a.detalles.map((d) => ({ cuentaId: db(d.cuentaId), contado: texto(d.contado) })) });
          // The service stamps «now»; the story needs the day it was counted.
          await prisma.cnArqueo.update({ where: { id: r.arqueoId }, data: { fecha: new Date(a.fecha) } });
          expect(r.detalles.map((d) => d.saldoSistema)).toEqual(a.detalles.map((d) => d.saldoSistema));
        },
      });
    }
    pasos.push({
      cuando: "2027-01-02T09",
      hacer: async () => {
        const cierre = mundo.movimientos.find((m) => m.clave)!;
        const r = await pasarCierreAlAhorro({ mes: "2026-12", cuentaOrigenId: db("casa"), monto: texto(cierre.monto) }, E02);
        id.set(cierre.id, r.movimientoId);
      },
    });
    pasos.sort((a, b) => a.cuando.localeCompare(b.cuando));
    for (const paso of pasos) await paso.hacer();
  }, 120_000);

  afterAll(async () => {
    vi.useRealTimers();
    await prisma.$disconnect();
  });

  /** A database read with world ids in place of database ids, for comparison. */
  function normalizar(datos: CasaNegocioMes) {
    const mundoDe = new Map([...id].map(([w, d]) => [d, w]));
    const w = (x: string | null) => (x === null ? null : (mundoDe.get(x) ?? x));
    return {
      cuentas: datos.cuentas.map((c) => ({ id: w(c.id), saldoInicioMes: c.saldoInicioMes, entradasMes: c.entradasMes, salidasMes: c.salidasMes, saldoFinMes: c.saldoFinMes, saldoActual: c.saldoActual })),
      movimientos: datos.movimientos.map((m) => [w(m.id), m.tipo, m.fecha, m.monto, w(m.cuentaOrigenId), w(m.cuentaDestinoId), w(m.categoriaId)]),
      cobros: datos.cobros.map((c) => [w(c.eventoFinancieroId), c.fechaPago, c.capital, c.interes, c.total, w(c.cuentaId), c.asignable]),
      desembolsos: datos.desembolsos.map((d) => [w(d.creditoId), d.fecha, d.monto, w(d.cuentaId), d.asignable]),
      sinCuenta: [datos.sinCuenta.cobros.map((c) => w(c.eventoFinancieroId)), datos.sinCuenta.desembolsos.map((d) => w(d.creditoId))],
      cuotas: datos.cuotasPorCobrar.map((c) => [w(c.eventoFinancieroId), c.pendiente, c.diasAtraso]),
      cartera: [datos.cartera.enLaCalle, datos.cartera.creditosActivos, datos.cartera.tramos],
      categorias: datos.categorias.map((c) => [w(c.id), c.gastadoMes, c.venceEnMes, c.fechaPagoMes, c.pagadoMes, c.proximoVencimiento]),
      castigos: datos.castigos.map((c) => [w(c.creditoId), c.monto, c.fecha]),
      historial: datos.historial,
      cierreAnterior: datos.cierreAnterior,
      inicioModulo: datos.inicioModulo,
    };
  }

  /** The pure mirror with the same comparison shape. */
  function espejo(mes: string, ahora: Date) {
    const datos = leerMes(mundo, mes, ahora);
    const n = normalizar(datos);
    // The mirror already uses world ids; sort accounts and categories the way the database orders them.
    return n;
  }

  const porId = <T extends { id: string | null }>(xs: T[]) => [...xs].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const porPrimero = (xs: unknown[][]) => [...xs].sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  // Only «today» is comparable: the database holds the whole story, while the
  // mirror can also rewind to earlier days (the pure suites do that).
  for (const [mes, ahora] of [["2026-12", E20], ["2027-01", E20]] as const) {
    it(`la lectura real de ${mes} (vista el ${ahora.toISOString().slice(0, 10)}) es la del espejo puro`, async () => {
      const real = normalizar(await cargarCasaNegocioMes(prisma, lector, mes, ahora));
      const puro = espejo(mes, ahora);
      expect(porId(real.cuentas)).toEqual(porId(puro.cuentas));
      expect(porPrimero(real.movimientos)).toEqual(porPrimero(puro.movimientos));
      expect(real.cobros).toEqual(puro.cobros);
      expect(real.desembolsos).toEqual(puro.desembolsos);
      expect(real.sinCuenta).toEqual(puro.sinCuenta);
      expect(real.cuotas).toEqual(puro.cuotas);
      expect(real.cartera).toEqual(puro.cartera);
      expect(porPrimero(real.categorias)).toEqual(porPrimero(puro.categorias));
      expect(real.castigos).toEqual(puro.castigos);
      expect(real.historial).toEqual(puro.historial);
      expect(real.cierreAnterior).toEqual(puro.cierreAnterior);
      expect(real.inicioModulo).toBe(puro.inicioModulo);
    });
  }

  it("diciembre: ecuaciones, saldos y dinero de la familia", async () => {
    const datos = await cargarCasaNegocioMes(prisma, lector, "2026-12", E20);
    const { calculo } = evaluarMes(datos);
    expect(calculo.negocio).toEqual({ intereses: 500_000, gastos: 80_000, perdidos: 1_500_000, ganancia: -1_080_000, retirosCasa: 3_000_000, reinvertido: -4_080_000 });
    expect(calculo.casa).toMatchObject({ entro: 3_400_000, fijos: 1_800_000, variables: 1_180_000, hoy: 420_000, alCierre: 420_000 });
    expect(datos.cuentas.reduce((s, c) => s + c.saldoFinMes, 0)).toBe(17_940_000);
    expect(datos.cartera.enLaCalle).toBe(10_100_000);
  });

  it("«Pasar al ahorro» una sola vez por mes", async () => {
    const otra = await pasarCierreAlAhorro({ mes: "2026-12", cuentaOrigenId: db("casa"), monto: "420.000" }, local("2027-01-03"));
    expect(otra).toMatchObject({ movimientoId: db("e-cierre-dic"), repetido: true });
    expect(await prisma.cnMovimiento.count({ where: { idempotencyKey: { startsWith: "ahorro-cierre-2026-12-" } } })).toBe(1);
    const dic = await cargarCasaNegocioMes(prisma, lector, "2026-12", E20);
    const ahorro = construirVistaAhorro(dic, await leerCierresAhorro(prisma as never));
    expect(ahorro.estado === "LISTO" && ahorro.cierre).toMatchObject({ estado: "HECHO", hecho: { monto: 420_000, fecha: "2027-01-02" } });
    // Same as the pure mirror's cierres.
    expect((await leerCierresAhorro(prisma as never)).map((c) => [c.mes, c.monto, c.fecha])).toEqual(cierresDe(mundo, E20).map((c) => [c.mes, c.monto, c.fecha]));
  });

  it("Resumen real: la tarjeta de diciembre es la del Tablero", async () => {
    const resumen = await cargarVistaResumen(prisma, lector, 12, E20);
    expect(resumen.tarjetas.find((t) => t.mes === "2026-12")).toMatchObject({ ganancia: -1_080_000, retiros: 3_000_000, reinvertido: -4_080_000, casaSobro: 420_000, ahorro: 5_000_000 });
    expect(resumen.tarjetas.find((t) => t.mes === "2027-01")).toMatchObject({ ganancia: 120_000, retiros: 100_000, ahorro: 5_420_000 });
  });

  it("editar en enero un gasto de diciembre y revertir el castigo recalculan diciembre", async () => {
    const row = await prisma.cnMovimiento.findUniqueOrThrow({ where: { id: db("d-gasto-neg") } });
    await editarMovimiento({
      movimientoId: row.id,
      version: row.actualizadoEn.toISOString(),
      tipo: "GASTO_NEGOCIO",
      fecha: "2026-12-04",
      monto: "180.000",
      cuentaOrigenId: db("efectivo"),
      nota: "Papelería",
    });
    const castigo = await prisma.cnCastigoCredito.findUniqueOrThrow({ where: { id: db("cast-d") } });
    await revertirCastigo({ castigoId: castigo.id, version: castigo.actualizadoEn.toISOString(), motivo: "Volvió a pagar" });

    const dic = await cargarCasaNegocioMes(prisma, lector, "2026-12", E20);
    expect(evaluarMes(dic).calculo.negocio).toMatchObject({ gastos: 180_000, perdidos: 0, ganancia: 320_000, reinvertido: -2_680_000 });
    const enero = await cargarCasaNegocioMes(prisma, lector, "2027-01", E20);
    expect(enero.cuentas.find((c) => c.id === db("efectivo"))!.saldoInicioMes).toBe(1_320_000);
    expect(enero.cartera.enLaCalle).toBe(12_100_000);
    expect(evaluarMes(enero).avisos.find((a) => a.reglaId === "CREDITO_SIN_PAGOS")?.refs).toEqual([db("cr-d")]);
  });
});
