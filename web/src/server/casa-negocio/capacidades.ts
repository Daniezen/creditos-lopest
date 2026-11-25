/**
 * Capability-based authorization for Casa y Negocio (spec §2).
 *
 * The module does not reuse `Role.code`: who may see, write, count or
 * configure the family money is decided per person in Configuración and
 * stored in "cn_permisos" (one row per granted capability). Roles still decide
 * which LOANS a person sees (`@/server/auth/scope`); capabilities decide what
 * they may do in this module. Both are checked on the server, every time.
 *
 * Capability names in code and in the audit log are `casa_negocio.<x>`; the
 * enum values in the database are VER / ANOTAR / CONTAR / CONFIGURAR.
 */
import type { CnCapacidad, Prisma } from "@prisma/client";

import type { AppRole } from "@/server/auth/guards";

import { CasaNegocioPermisoError } from "./errors";

export type Capacidad = CnCapacidad;

/** Public name of each capability, as written in the spec and the audit log. */
export const CODIGO_CAPACIDAD: Record<Capacidad, string> = {
  VER: "casa_negocio.ver",
  ANOTAR: "casa_negocio.anotar",
  CONTAR: "casa_negocio.contar",
  CONFIGURAR: "casa_negocio.configurar",
};

const MENSAJE: Record<Capacidad, string> = {
  VER: "No tienes acceso a Casa y Negocio.",
  ANOTAR: "No tienes permiso para anotar movimientos en Casa y Negocio.",
  CONTAR: "No tienes permiso para guardar arqueos.",
  CONFIGURAR: "No tienes permiso para cambiar la configuración de Casa y Negocio.",
};

/** The authenticated person acting in the module. */
export interface ActorCasaNegocio {
  id: string;
  nombre: string;
  /** App roles, still used for loan visibility (`buildCreditoVisibilityWhere`). */
  roles: AppRole[];
  capacidades: ReadonlySet<Capacidad>;
}

/** Minimal client surface needed here, so tests can pass a stub. */
type PermisoReader = { cnPermiso: Pick<Prisma.TransactionClient["cnPermiso"], "findMany"> };

/** Capabilities currently granted to a user. */
export async function capacidadesDe(db: PermisoReader, userId: string): Promise<Set<Capacidad>> {
  const rows = await db.cnPermiso.findMany({ where: { userId }, select: { capacidad: true } });
  return new Set(rows.map((row) => row.capacidad));
}

/** Throws `CasaNegocioPermisoError` unless the set contains the capability. */
export function assertCapacidad(capacidades: ReadonlySet<Capacidad>, capacidad: Capacidad): void {
  if (!capacidades.has(capacidad)) throw new CasaNegocioPermisoError(MENSAJE[capacidad]);
}

/**
 * Authenticates the request and demands a capability. Imports are lazy so the
 * pure helpers above stay importable from tests without NextAuth or a
 * DATABASE_URL.
 */
export async function requireCapacidad(capacidad: Capacidad): Promise<ActorCasaNegocio> {
  const [{ requireUser }, { prisma }] = await Promise.all([import("@/server/auth/guards"), import("@/lib/prisma")]);
  const user = await requireUser();
  const capacidades = await capacidadesDe(prisma, user.id);
  assertCapacidad(capacidades, capacidad);
  return { id: user.id, nombre: user.nombre, roles: user.roles, capacidades };
}
