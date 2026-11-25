/**
 * Plumbing shared by the Casa y Negocio write services: audit naming, JSON
 * images for the audit log, Prisma error classification and row loaders used
 * inside transactions.
 */
import { Prisma } from "@prisma/client";

import { CasaNegocioReglaError } from "./errors";
import type { CategoriaRegla, CuentaRegla } from "./rules";

/** `AuditLog.entityType` values written by this module. */
export const ENTIDAD = {
  cuenta: "CnCuenta",
  movimiento: "CnMovimiento",
  asignacion: "CnAsignacionCuenta",
  categoria: "CnCategoriaGasto",
  arqueo: "CnArqueo",
  configuracion: "CnConfiguracion",
  regla: "CnReglaAviso",
  permiso: "CnPermiso",
  castigo: "CnCastigoCredito",
} as const;

/** `AuditLog.action` prefix: every action of the module reads `casa_negocio.<verb>`. */
export function accion(verbo: string): string {
  return `casa_negocio.${verbo}`;
}

/**
 * Turns a row into audit JSON: Decimals become their exact string, Dates
 * ISO strings, so the before/after images compare and read cleanly.
 */
export function imagen(row: Record<string, unknown>): Prisma.InputJsonObject {
  const out: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (value instanceof Date) out[key] = value.toISOString();
    else if (value instanceof Prisma.Decimal) out[key] = value.toFixed(2);
    else if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else out[key] = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
  return out as Prisma.InputJsonObject;
}

/** True for a unique-constraint violation (concurrent create, replayed key). */
export function esViolacionUnica(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type Db = Prisma.TransactionClient;

const CUENTA_REGLA_SELECT = { id: true, nombre: true, grupo: true, archivada: true, fechaSaldoInicial: true } as const;

/** Loads an account for rule checks; null id gives null, an unknown id fails. */
export async function cuentaParaRegla(db: Db, id: string | null, field: string): Promise<CuentaRegla | null> {
  if (!id) return null;
  const cuenta = await db.cnCuenta.findUnique({ where: { id }, select: CUENTA_REGLA_SELECT });
  if (!cuenta) throw new CasaNegocioReglaError("La cuenta indicada no existe.", field);
  return cuenta;
}

export async function categoriaParaRegla(db: Db, id: string | null): Promise<CategoriaRegla | null> {
  if (!id) return null;
  const categoria = await db.cnCategoriaGasto.findUnique({
    where: { id },
    select: { id: true, nombre: true, clase: true, activa: true },
  });
  if (!categoria) throw new CasaNegocioReglaError("El gasto indicado no existe.", "categoriaId");
  return categoria;
}
