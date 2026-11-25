/**
 * End-to-end check of the Casa y Negocio data layer against a real
 * PostgreSQL: migrations, services, audit and the month read together.
 *
 * Skipped unless CN_TEST_DATABASE_URL points at a THROWAWAY database whose
 * name contains "test" (the guard below refuses anything else, so this can
 * never touch lopest_db). Recipe:
 *
 *   docker run --rm -d --name cn-test-pg -e POSTGRES_USER=lopest_admin \
 *     -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=cn_test -p 127.0.0.1:55432:5432 postgres:18.4-alpine
 *   DATABASE_URL=postgresql://lopest_admin:pw@127.0.0.1:55432/cn_test pnpm exec prisma migrate deploy
 *   CN_TEST_DATABASE_URL=postgresql://lopest_admin:pw@127.0.0.1:55432/cn_test pnpm exec vitest run casa-negocio.integration
 *
 * The cn_* tables and the test loans (`LP-T-*`) are wiped at the start;
 * users get unique ids per run because the append-only audit log keeps
 * referencing them and they cannot be deleted.
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
import { ConcurrentModificationError } from "@/server/optimistic-lock";

import { guardarArqueo } from "../arqueos";
import { asignarCuenta } from "../asignaciones";
import { registrarCastigo } from "../castigos";
import { crearCategoria, crearCuenta, definirCapacidades, editarCategoria, editarConfiguracion } from "../configuracion";
import { CasaNegocioPermisoError, CasaNegocioReglaError } from "../errors";
import { anularMovimiento, editarMovimiento, pasarAlAhorro, registrarMovimiento } from "../movimientos";
import { cargarCasaNegocioMes } from "../queries";
import { capacidadesDe } from "../capacidades";

const run = randomUUID().slice(0, 8);
const PADRE = { id: `padre_${run}`, nombre: "Padre", roles: ["ADMIN"] };
const MADRE = { id: `madre_${run}`, nombre: "Madre", roles: ["LECTURA"] };
const key = () => randomUUID();
/** Local midnight in Bogota for a YYYY-MM-DD, as the app stores days. */
const dia = (fecha: string) => new Date(`${fecha}T05:00:00.000Z`);

async function lector(user: typeof PADRE) {
  return { ...user, roles: user.roles as never, capacidades: await capacidadesDe(prisma, user.id) };
}

describe.skipIf(!URL_PRUEBA)("Casa y Negocio contra PostgreSQL", () => {
  const ids = { efectivo: "", banco: "", casa: "", nu: "", arriendo: "", mercado: "", credito: "", cuota1: "", cuotaVieja: "" };

  beforeAll(async () => {
    const nombreDb = new URL(URL_PRUEBA!).pathname.slice(1);
    if (!nombreDb.includes("test")) throw new Error(`Base "${nombreDb}" no parece desechable; se aborta.`);

    for (const sql of [
      `DELETE FROM "cn_arqueo_detalles"`,
      `DELETE FROM "cn_arqueos"`,
      `DELETE FROM "cn_asignaciones_cuenta"`,
      `DELETE FROM "cn_movimientos"`,
      `DELETE FROM "cn_castigos_credito"`,
      `DELETE FROM "cn_permisos"`,
      `UPDATE "cn_configuracion" SET "cuentaAhorroId" = NULL, "metaAhorro" = NULL, "metaAsignacionCasa" = NULL`,
      `DELETE FROM "cn_categorias_gasto"`,
      `DELETE FROM "cn_cuentas"`,
      // Loans of earlier runs (events cascade); their users stay, the audit log references them.
      `DELETE FROM "creditos" WHERE "codigo" LIKE 'LP-T-%'`,
      `DELETE FROM "clientes" WHERE "cedula" LIKE 'ced_%'`,
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

    const cliente = await prisma.cliente.create({ data: { cedula: `ced_${run}`, nombre: "Cliente Prueba", ownerUserId: PADRE.id } });
    const credito = await prisma.credito.create({
      data: {
        codigo: `LP-T-${run}`,
        clienteId: cliente.id,
        ownerUserId: PADRE.id,
        fechaPrestamo: dia("2026-11-02"),
        monto: "500000.00",
        plazoMeses: "2",
        tasaMensual: "0.05",
        frecuencia: "MENSUAL",
      },
    });
    ids.credito = credito.id;
    const evento = (n: number, extra: Record<string, unknown>) => ({
      codigo: `EV-${run}-${n}`,
      creditoId: credito.id,
      numeroCuota: n,
      valorProgramado: "125000.00",
      capitalProgramado: "100000.00",
      interesProgramado: "25000.00",
      fechaProgramada: dia("2026-11-10"),
      ...extra,
    });
    const viejo = await prisma.eventoFinanciero.create({
      data: evento(0, { fechaProgramada: dia("2026-10-20"), fechaPago: dia("2026-10-20"), estado: "PAGADO", montoPagado: "125000.00", capitalPagado: "100000.00", interesPagado: "25000.00" }),
    });
    const c1 = await prisma.eventoFinanciero.create({
      data: evento(1, { fechaPago: dia("2026-11-10"), estado: "PAGADO", montoPagado: "125000.00", capitalPagado: "100000.00", interesPagado: "25000.00" }),
    });
    await prisma.eventoFinanciero.create({ data: evento(2, { fechaProgramada: dia("2026-12-10") }) });
    ids.cuota1 = c1.id;
    ids.cuotaVieja = viejo.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("configura cuentas, gastos y ahorro", async () => {
    sesion.user = PADRE;
    const cuenta = (nombre: string, grupo: string, tipo: string, saldoInicial: string) =>
      crearCuenta({ nombre, grupo, tipo, saldoInicial, fechaSaldoInicial: "2026-11-01" });
    ids.efectivo = (await cuenta("Efectivo", "NEGOCIO", "EFECTIVO", "1.000.000")).cuentaId;
    ids.banco = (await cuenta("Bancolombia", "NEGOCIO", "BANCO", "0")).cuentaId;
    ids.casa = (await cuenta("Cuenta casa", "CASA", "BANCO", "200.000")).cuentaId;
    ids.nu = (await cuenta("Nu · ahorro", "CASA", "AHORRO", "0")).cuentaId;
    ids.arriendo = (await crearCategoria({ nombre: "Arriendo", clase: "FIJO", monto: "1.787.000", periodicidad: "MENSUAL", diaPago: "17" })).categoriaId;
    ids.mercado = (await crearCategoria({ nombre: "Mercado", clase: "VARIABLE", monto: "2.700.000", periodicidad: "MENSUAL" })).categoriaId;

    const config = await prisma.cnConfiguracion.findUniqueOrThrow({ where: { id: "default" } });
    await editarConfiguracion({ version: config.actualizadoEn.toISOString(), cuentaAhorroId: ids.nu, metaAhorro: "1.000.000" });

    await expect(crearCuenta({ nombre: "Efectivo", grupo: "CASA", tipo: "EFECTIVO", saldoInicial: "0", fechaSaldoInicial: "2026-11-01" })).rejects.toThrow(
      "Ya existe una cuenta",
    );
  });

  it("asigna cuenta a desembolso y cobro, y no a lo anterior al arranque", async () => {
    sesion.user = PADRE;
    await asignarCuenta({ creditoId: ids.credito, cuentaId: ids.efectivo });
    await asignarCuenta({ eventoFinancieroId: ids.cuota1, cuentaId: ids.banco });
    await expect(asignarCuenta({ eventoFinancieroId: ids.cuotaVieja, cuentaId: ids.banco })).rejects.toBeInstanceOf(CasaNegocioReglaError);
    await expect(asignarCuenta({ eventoFinancieroId: ids.cuota1, cuentaId: ids.casa })).rejects.toThrow("cuenta del negocio");
    // Changing an existing assignment without its version is a stale form.
    await expect(asignarCuenta({ eventoFinancieroId: ids.cuota1, cuentaId: ids.efectivo })).rejects.toBeInstanceOf(ConcurrentModificationError);
  });

  it("registra movimientos, respeta grupos y cuadra los saldos", async () => {
    sesion.user = PADRE;
    const gastoKey = key();
    const gasto = await registrarMovimiento({ operationKey: gastoKey, tipo: "GASTO_NEGOCIO", fecha: "2026-11-05", monto: "50.000", cuentaOrigenId: ids.efectivo });
    const replay = await registrarMovimiento({ operationKey: gastoKey, tipo: "GASTO_NEGOCIO", fecha: "2026-11-05", monto: "50.000", cuentaOrigenId: ids.efectivo });
    expect(replay).toMatchObject({ movimientoId: gasto.movimientoId, repetido: true });

    const retiro = await registrarMovimiento({ operationKey: key(), tipo: "RETIRO_CASA", fecha: "2026-11-12", monto: "300.000", cuentaOrigenId: ids.efectivo, cuentaDestinoId: ids.casa });
    expect(retiro.saldoOrigenDespues).toBe(150000);
    await registrarMovimiento({ operationKey: key(), tipo: "GASTO_FIJO", fecha: "2026-11-17", monto: "150.000", cuentaOrigenId: ids.casa, categoriaId: ids.arriendo });
    await pasarAlAhorro({ operationKey: key(), cuentaOrigenId: ids.casa, monto: "20.000", fecha: "2026-11-20" });

    // A cross-group TRASLADO is refused: that is what RETIRO_CASA is for.
    await expect(
      registrarMovimiento({ operationKey: key(), tipo: "TRASLADO", fecha: "2026-11-12", monto: "1", cuentaOrigenId: ids.efectivo, cuentaDestinoId: ids.casa }),
    ).rejects.toThrow("mismo grupo");
    // Before the account's opening date.
    await expect(
      registrarMovimiento({ operationKey: key(), tipo: "GASTO_NEGOCIO", fecha: "2026-10-31", monto: "1", cuentaOrigenId: ids.efectivo }),
    ).rejects.toThrow("arranca después");

    const mes = await cargarCasaNegocioMes(prisma, await lector(PADRE), "2026-11", dia("2026-11-25"));
    const saldo = (id: string) => mes.cuentas.find((c) => c.id === id)!;
    expect(saldo(ids.efectivo).saldoActual).toBe(1_000_000 - 500_000 - 50_000 - 300_000);
    expect(saldo(ids.banco).saldoActual).toBe(125_000);
    expect(saldo(ids.casa).saldoActual).toBe(200_000 + 300_000 - 150_000 - 20_000);
    expect(saldo(ids.nu).saldoActual).toBe(20_000);
    expect(saldo(ids.efectivo)).toMatchObject({ saldoInicioMes: 1_000_000, entradasMes: 0, salidasMes: 850_000, saldoFinMes: 150_000 });

    const nov = mes.historial.at(-1)!;
    expect(nov).toMatchObject({
      mes: "2026-11",
      interesCobrado: 25_000,
      capitalCobrado: 100_000,
      desembolsado: 500_000,
      gastosNegocio: 50_000,
      retirosCasa: 300_000,
      gastosFijos: 150_000,
      depositosAhorro: 20_000,
    });
    expect(mes.historial.find((h) => h.mes === "2026-10")?.interesCobrado).toBe(25_000);
    expect(mes.cobros.map((c) => c.eventoFinancieroId)).toEqual([ids.cuota1]);
    expect(mes.cobros[0]).toMatchObject({ cuentaId: ids.banco, asignable: true, esPropio: true, total: 125_000 });
    expect(mes.sinCuenta.cobros).toEqual([]);
    expect(mes.desembolsos[0]).toMatchObject({ cuentaId: ids.efectivo, monto: 500_000 });
    expect(mes.categorias.find((c) => c.id === ids.arriendo)).toMatchObject({ gastadoMes: 150_000, pagadoMes: true, fechaPagoMes: "2026-11-17" });
    expect(mes.proyeccion[1]).toMatchObject({ mes: "2026-12", total: 125_000, cuotas: 1 });
    // 500.000 lent minus the capital of both paid events (the October one included).
    expect(mes.cartera.creditos[0]).toMatchObject({ saldoCapital: 300_000, tramo: "AL_DIA", ultimoPago: "2026-11-10" });
    expect(mes.configuracion.reglas).toHaveLength(10);
    expect(mes.permisos?.find((p) => p.userId === MADRE.id)?.capacidades).toEqual(["VER"]);
  });

  it("edita con bloqueo optimista y anula sin borrar", async () => {
    sesion.user = PADRE;
    const mov = await prisma.cnMovimiento.findFirstOrThrow({ where: { tipo: "GASTO_NEGOCIO", eliminadoEn: null } });
    const version = mov.actualizadoEn.toISOString();
    await editarMovimiento({ movimientoId: mov.id, version, tipo: "GASTO_NEGOCIO", fecha: "2026-11-05", monto: "60.000", cuentaOrigenId: ids.efectivo });
    await expect(
      editarMovimiento({ movimientoId: mov.id, version, tipo: "GASTO_NEGOCIO", fecha: "2026-11-05", monto: "70.000", cuentaOrigenId: ids.efectivo }),
    ).rejects.toBeInstanceOf(ConcurrentModificationError);

    const actual = await prisma.cnMovimiento.findUniqueOrThrow({ where: { id: mov.id } });
    await anularMovimiento({ movimientoId: mov.id, version: actual.actualizadoEn.toISOString(), motivo: "duplicado" });
    expect(await prisma.cnMovimiento.count({ where: { id: mov.id } })).toBe(1);

    const mes = await cargarCasaNegocioMes(prisma, await lector(PADRE), "2026-11", dia("2026-11-25"));
    expect(mes.cuentas.find((c) => c.id === ids.efectivo)!.saldoActual).toBe(1_000_000 - 500_000 - 300_000);
    expect(mes.movimientos.some((m) => m.id === mov.id)).toBe(false);
  });

  it("al pasar un gasto de fijo a variable sus movimientos lo siguen", async () => {
    sesion.user = PADRE;
    const cat = await prisma.cnCategoriaGasto.findUniqueOrThrow({ where: { id: ids.arriendo } });
    const res = await editarCategoria({
      categoriaId: cat.id,
      version: cat.actualizadoEn.toISOString(),
      nombre: "Arriendo",
      clase: "VARIABLE",
      monto: "1.787.000",
      periodicidad: "MENSUAL",
    });
    expect(res.movimientosReclasificados).toBe(1);
    const mes = await cargarCasaNegocioMes(prisma, await lector(PADRE), "2026-11", dia("2026-11-25"));
    expect(mes.historial.at(-1)).toMatchObject({ gastosFijos: 0, gastosVariables: 150_000 });
  });

  it("guarda el arqueo con el saldo que calcula el servidor", async () => {
    sesion.user = PADRE;
    const arqueo = await guardarArqueo({ operationKey: key(), conteos: [{ cuentaId: ids.efectivo, contado: "190.000" }] });
    expect(arqueo.detalles[0]).toMatchObject({ saldoSistema: 200_000, contado: 190_000, diferencia: -10_000 });
    const mes = await cargarCasaNegocioMes(prisma, await lector(PADRE), "2026-11", dia("2026-11-25"));
    expect(mes.cuentas.find((c) => c.id === ids.efectivo)!.ultimoArqueo).not.toBeNull();
    expect(mes.arqueos[0].detalles[0].diferencia).toBe(-10_000);
  });

  it("la madre solo ve: no anota, no ve permisos y solo ve sus créditos", async () => {
    sesion.user = MADRE;
    await expect(
      registrarMovimiento({ operationKey: key(), tipo: "INGRESO_CASA", fecha: "2026-11-20", monto: "1", cuentaDestinoId: ids.casa }),
    ).rejects.toBeInstanceOf(CasaNegocioPermisoError);
    await expect(guardarArqueo({ operationKey: key(), conteos: [{ cuentaId: ids.casa, contado: "0" }] })).rejects.toBeInstanceOf(CasaNegocioPermisoError);

    const mes = await cargarCasaNegocioMes(prisma, await lector(MADRE), "2026-11", dia("2026-11-25"));
    expect(mes.permisos).toBeNull();
    expect(mes.cobros).toEqual([]);
    expect(mes.cuentas.find((c) => c.id === ids.casa)!.saldoActual).toBe(330_000); // balances are module-wide
  });

  it("nunca deja el módulo sin quien configure", async () => {
    sesion.user = PADRE;
    await expect(definirCapacidades({ userId: PADRE.id, capacidades: ["VER"] })).rejects.toThrow("Alguien tiene que poder configurar");
    await definirCapacidades({ userId: MADRE.id, capacidades: ["ANOTAR"] });
    expect([...(await capacidadesDe(prisma, MADRE.id))].sort()).toEqual(["ANOTAR", "VER"]);
  });

  it("castiga un crédito una sola vez y lo saca de la calle", async () => {
    sesion.user = PADRE;
    await registrarCastigo({ creditoId: ids.credito, monto: "300.000", fecha: "2026-11-21", motivo: "Cliente desaparecido" });
    await expect(registrarCastigo({ creditoId: ids.credito, monto: "1", fecha: "2026-11-21", motivo: "x" })).rejects.toThrow("ya está marcado");
    const mes = await cargarCasaNegocioMes(prisma, await lector(PADRE), "2026-11", dia("2026-11-25"));
    expect(mes.cartera.enLaCalle).toBe(0);
    expect(mes.historial.at(-1)!.perdidas).toBe(300_000);
    expect(mes.proyeccion[1].cuotas).toBe(0);
  });

  it("audita cada mutación con su actor", async () => {
    const acciones = await prisma.auditLog.findMany({ where: { actorId: PADRE.id }, select: { action: true } });
    const nombres = new Set(acciones.map((a) => a.action));
    for (const esperada of [
      "casa_negocio.cuenta.crear",
      "casa_negocio.categoria.crear",
      "casa_negocio.configuracion.editar",
      "casa_negocio.asignacion.crear",
      "casa_negocio.movimiento.registrar",
      "casa_negocio.movimiento.editar",
      "casa_negocio.movimiento.anular",
      "casa_negocio.categoria.editar",
      "casa_negocio.arqueo.guardar",
      "casa_negocio.permisos.definir",
      "casa_negocio.castigo.registrar",
    ]) {
      expect(nombres).toContain(esperada);
    }
    // The replayed GASTO_NEGOCIO wrote a single audit row.
    expect(acciones.filter((a) => a.action === "casa_negocio.movimiento.registrar")).toHaveLength(4);
  });
});
