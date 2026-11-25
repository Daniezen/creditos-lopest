#!/usr/bin/env node
/**
 * Starting data of the Casa y Negocio module for the 1-dic-2026 launch:
 * accounts, household expense categories (from the family Excel) and the
 * initial capabilities (padre and Daniel: all four; madre: ver).
 *
 * IDEMPOTENT. Everything is matched by a natural key and only created when
 * missing: accounts and categories by `nombre`, capabilities by (user,
 * capability). Existing rows are never overwritten, so running it again after
 * someone adjusted an amount in Configuración changes nothing, and a
 * capability removed on purpose is NOT re-granted unless the person is passed
 * again (the grants are additive). The savings account is set in the settings
 * only while none is chosen. Every created row is listed in one audit entry
 * (`casa_negocio.semilla`, actor NULL: it is an operator script).
 *
 * PEOPLE ARE IDENTIFIED BY E-MAIL PASSED ON THE COMMAND LINE; no address is
 * written in this file. The users must already exist in Lopest.
 *
 * Usage (from web/, with DATABASE_URL pointing at the target database):
 *
 *   node scripts/casa-negocio-semilla.mjs --padre <correo> --daniel <correo> --madre <correo> \
 *     [--fecha 2026-12-01] [--saldo "Efectivo=1.250.000"]... [--aplicar]
 *
 * Without --aplicar it is a dry run: it computes and prints the plan inside a
 * transaction that is rolled back. `--saldo` sets the opening balance of an
 * account being CREATED (ignored, with a warning, for an existing one).
 *
 * In production it runs inside the migrator image, which has Prisma Client
 * and DATABASE_URL (see docs/estado/operacion.md for the compose command).
 */
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Data from the family Excel ("Cuentas Casa y Negocio") and the approved canvas
// ---------------------------------------------------------------------------

/** grupo, tipo, orden inside the group. */
const CUENTAS = [
  { nombre: "Efectivo", grupo: "NEGOCIO", tipo: "EFECTIVO", orden: 1 },
  { nombre: "Bancolombia", grupo: "NEGOCIO", tipo: "BANCO", orden: 2 },
  { nombre: "Nequi", grupo: "NEGOCIO", tipo: "BILLETERA", orden: 3 },
  { nombre: "Cuenta casa", grupo: "CASA", tipo: "BANCO", orden: 1 },
  { nombre: "Nu · ahorro", grupo: "CASA", tipo: "AHORRO", orden: 2 },
];
const CUENTA_AHORRO = "Nu · ahorro";

/** FIJO: monto + día (monthly) or mes (annual). VARIABLE: monthly cap. */
const CATEGORIAS = [
  { nombre: "Arriendo", clase: "FIJO", monto: 1787000, periodicidad: "MENSUAL", diaPago: 17 },
  { nombre: "Internet y TV", clase: "FIJO", monto: 120000, periodicidad: "MENSUAL", diaPago: 20 },
  { nombre: "Crédito Davivienda", clase: "FIJO", monto: 820000, periodicidad: "MENSUAL", diaPago: 16 },
  { nombre: "Funeraria", clase: "FIJO", monto: 32000, periodicidad: "MENSUAL", diaPago: 16 },
  { nombre: "Seguros Bolo", clase: "FIJO", monto: 170000, periodicidad: "MENSUAL", diaPago: 20 },
  { nombre: "Tecnomecánica Bolo", clase: "FIJO", monto: 360000, periodicidad: "ANUAL", mesAnual: 3 },
  { nombre: "SOAT Bolo", clase: "FIJO", monto: 660000, periodicidad: "ANUAL", mesAnual: 8 },
  { nombre: "Impuesto Bolo", clase: "FIJO", monto: 180000, periodicidad: "ANUAL", mesAnual: 6 },
  { nombre: "EPM", clase: "VARIABLE", monto: 470000, periodicidad: "MENSUAL" },
  { nombre: "Mercado", clase: "VARIABLE", monto: 2700000, periodicidad: "MENSUAL" },
  { nombre: "Gasolina", clase: "VARIABLE", monto: 200000, periodicidad: "MENSUAL" },
  { nombre: "Salud", clase: "VARIABLE", monto: 50000, periodicidad: "MENSUAL" },
  { nombre: "Entretenimiento", clase: "VARIABLE", monto: 150000, periodicidad: "MENSUAL" },
  { nombre: "Imprevistos", clase: "VARIABLE", monto: 500000, periodicidad: "MENSUAL" },
];

const TODAS = ["VER", "ANOTAR", "CONTAR", "CONFIGURAR"];
const PERSONAS = [
  { flag: "padre", capacidades: TODAS },
  { flag: "daniel", capacidades: TODAS },
  { flag: "madre", capacidades: ["VER"] },
];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function fail(message) {
  process.stderr.write(`[semilla] ${message}\n`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    padre: { type: "string" },
    daniel: { type: "string" },
    madre: { type: "string" },
    fecha: { type: "string", default: "2026-12-01" },
    saldo: { type: "string", multiple: true, default: [] },
    aplicar: { type: "boolean", default: false },
  },
  strict: true,
});

for (const { flag } of PERSONAS) {
  if (!values[flag]) fail(`Falta --${flag} <correo>.`);
}

const fechaMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.fecha);
if (!fechaMatch) fail("--fecha debe tener el formato AAAA-MM-DD.");
// Local midnight in America/Bogota (fixed UTC-5), as the app stores days,
// independent of the TZ of the container running the script.
const fechaSaldoInicial = new Date(Date.UTC(Number(fechaMatch[1]), Number(fechaMatch[2]) - 1, Number(fechaMatch[3]), 5));

/** Same Colombian parsing as the app: dots are thousands, comma is decimal. */
function parseMonto(raw) {
  const cleaned = raw.trim().replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return value;
}

const saldos = new Map();
for (const item of values.saldo) {
  const [nombre, monto] = item.split("=");
  const cuenta = CUENTAS.find((c) => c.nombre === nombre?.trim());
  if (!cuenta) fail(`--saldo: no hay una cuenta llamada "${nombre}". Opciones: ${CUENTAS.map((c) => c.nombre).join(", ")}.`);
  const parsed = monto === undefined ? null : parseMonto(monto);
  if (parsed === null) fail(`--saldo: "${monto}" no es un monto válido para ${cuenta.nombre}.`);
  saldos.set(cuenta.nombre, parsed);
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL no está definida.");

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Thrown to roll back the dry run after computing the plan. */
class DryRun extends Error {}

const plan = { cuentas: [], categorias: [], permisos: [], cuentaAhorro: null, avisos: [] };

try {
  await prisma.$transaction(async (tx) => {
    // Users first: if one is missing nothing is written.
    const usuarios = [];
    for (const persona of PERSONAS) {
      const email = values[persona.flag].trim().toLowerCase();
      const user = await tx.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, nombre: true, activo: true },
      });
      if (!user) throw new Error(`No existe un usuario con el correo pasado en --${persona.flag}.`);
      if (!user.activo) plan.avisos.push(`--${persona.flag} (${user.nombre}) está inactivo en Lopest.`);
      usuarios.push({ ...persona, user });
    }

    for (const cuenta of CUENTAS) {
      const existente = await tx.cnCuenta.findUnique({ where: { nombre: cuenta.nombre }, select: { id: true } });
      if (existente) {
        if (saldos.has(cuenta.nombre)) plan.avisos.push(`${cuenta.nombre} ya existe: se ignora su --saldo.`);
        continue;
      }
      const saldoInicial = (saldos.get(cuenta.nombre) ?? 0).toFixed(2);
      const creada = await tx.cnCuenta.create({ data: { ...cuenta, saldoInicial, fechaSaldoInicial } });
      plan.cuentas.push({ id: creada.id, nombre: cuenta.nombre, saldoInicial });
    }

    for (const categoria of CATEGORIAS) {
      const existente = await tx.cnCategoriaGasto.findUnique({ where: { nombre: categoria.nombre }, select: { id: true } });
      if (existente) continue;
      const creada = await tx.cnCategoriaGasto.create({
        data: {
          nombre: categoria.nombre,
          clase: categoria.clase,
          monto: categoria.monto.toFixed(2),
          periodicidad: categoria.periodicidad,
          mesAnual: categoria.mesAnual ?? null,
          diaPago: categoria.diaPago ?? null,
          orden: CATEGORIAS.indexOf(categoria) + 1,
        },
      });
      plan.categorias.push({ id: creada.id, nombre: categoria.nombre });
    }

    for (const { flag, user, capacidades } of usuarios) {
      const result = await tx.cnPermiso.createMany({
        data: capacidades.map((capacidad) => ({ userId: user.id, capacidad })),
        skipDuplicates: true,
      });
      if (result.count > 0) plan.permisos.push({ persona: flag, userId: user.id, capacidades, nuevas: result.count });
    }

    const config = await tx.cnConfiguracion.findUnique({ where: { id: "default" } });
    if (!config) throw new Error("Falta la fila de configuración: aplica antes la migración 20261126120000_casa_negocio_v1.");
    if (!config.cuentaAhorroId) {
      const ahorro = await tx.cnCuenta.findUniqueOrThrow({ where: { nombre: CUENTA_AHORRO }, select: { id: true } });
      await tx.cnConfiguracion.update({ where: { id: "default" }, data: { cuentaAhorroId: ahorro.id } });
      plan.cuentaAhorro = ahorro.id;
    }

    const cambios = plan.cuentas.length + plan.categorias.length + plan.permisos.length + (plan.cuentaAhorro ? 1 : 0);
    if (cambios > 0) {
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "casa_negocio.semilla",
          entityType: "CnSemilla",
          entityId: null,
          reason: "Arranque del módulo Casa y Negocio (scripts/casa-negocio-semilla.mjs)",
          after: {
            fechaSaldoInicial: fechaSaldoInicial.toISOString(),
            cuentas: plan.cuentas,
            categorias: plan.categorias,
            permisos: plan.permisos.map(({ userId, capacidades }) => ({ userId, capacidades })),
            cuentaAhorroId: plan.cuentaAhorro,
          },
        },
      });
    }

    if (!values.aplicar) throw new DryRun();
  });
  report(values.aplicar ? "APLICADO" : "SIMULACIÓN");
} catch (error) {
  if (error instanceof DryRun) {
    report("SIMULACIÓN (nada se guardó; repite con --aplicar)");
  } else {
    process.stderr.write(`[semilla] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}

function report(modo) {
  const lines = [
    `[semilla] ${modo}`,
    `  cuentas nuevas:    ${plan.cuentas.map((c) => `${c.nombre} (${c.saldoInicial})`).join(", ") || "ninguna"}`,
    `  gastos nuevos:     ${plan.categorias.map((c) => c.nombre).join(", ") || "ninguno"}`,
    `  permisos nuevos:   ${plan.permisos.map((p) => `${p.persona} +${p.nuevas}`).join(", ") || "ninguno"}`,
    `  cuenta de ahorro:  ${plan.cuentaAhorro ? CUENTA_AHORRO : "sin cambio"}`,
    ...plan.avisos.map((a) => `  aviso: ${a}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}
