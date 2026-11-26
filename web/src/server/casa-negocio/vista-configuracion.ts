/**
 * Read side of the Configuración tab, plus the error-to-result mapping its
 * Server Actions share.
 *
 * Why a read of its own instead of `cargarCasaNegocioMes`: this tab needs no
 * month (no loans, no installments, no history), but it does need things the
 * month read leaves out on purpose: archived accounts with their current
 * balance, whether an account is referenced at all (delete vs archive),
 * per-category movement counts, and the people of Lopest with their login
 * photo. Loading only that keeps the tab cheap.
 *
 * Authorization: reading demands `casa_negocio.ver`; `puedeConfigurar` tells
 * the UI to render read-only, but every write re-checks CONFIGURAR on the
 * server (configuracion.ts), so the flag is presentation only.
 */
import type { CnCapacidad, Prisma, PrismaClient } from "@prisma/client";
import { unstable_rethrow } from "next/navigation";

import { CAPACIDADES, CODIGOS_AVISO } from "@/features/casa-negocio/schemas";
import { fechaClave } from "@/features/casa-negocio/mes";
import type {
  Capacidad,
  ClaseGasto,
  CodigoAviso,
  FechaDia,
  GrupoCuenta,
  Instante,
  Periodicidad,
  TipoCuenta,
} from "@/features/casa-negocio/types";
import { logEvent } from "@/server/observability/log";
import { ConcurrentModificationError } from "@/server/optimistic-lock";
import { InputValidationError, type FieldErrors } from "@/server/validation/input";

import { requireCapacidad, type ActorCasaNegocio } from "./capacidades";
import { aCentavos, aPesos } from "./dinero";
import { CasaNegocioPermisoError, CasaNegocioReglaError } from "./errors";
import { cargarAsientos, saldosActuales } from "./saldos";

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface CuentaConfig {
  id: string;
  nombre: string;
  grupo: GrupoCuenta;
  tipo: TipoCuenta;
  orden: number;
  archivada: boolean;
  saldoInicial: number;
  fechaSaldoInicial: FechaDia;
  saldoActual: number;
  /** Something references it: it can only be archived, never deleted. */
  tieneMovimientos: boolean;
  esCuentaAhorro: boolean;
  version: Instante;
}

export interface GastoConfig {
  id: string;
  nombre: string;
  clase: ClaseGasto;
  monto: number | null;
  periodicidad: Periodicidad;
  mesAnual: number | null;
  diaPago: number | null;
  activa: boolean;
  orden: number;
  /** Live movements booked against it (they follow it when its class flips). */
  movimientos: number;
  version: Instante;
}

export interface AvisoConfig {
  codigo: CodigoAviso;
  activa: boolean;
  umbral: number | null;
  version: Instante;
}

export interface PersonaConfig {
  userId: string;
  nombre: string;
  /** Login photo (`resolveLoginProfileImage`), null to show initials. */
  imagen: string | null;
  iniciales: string;
  activo: boolean;
  esUsted: boolean;
  capacidades: Capacidad[];
}

export interface VistaConfiguracion {
  puedeConfigurar: boolean;
  hoy: FechaDia;
  cuentas: CuentaConfig[];
  gastos: GastoConfig[];
  configuracion: {
    metaAsignacionCasa: number | null;
    metaAhorro: number | null;
    cuentaAhorroId: string | null;
    version: Instante;
  };
  avisos: AvisoConfig[];
  personas: PersonaConfig[];
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Two letters from the login name: «Daniel Lopera» -> «DL», «Madre» -> «M». */
export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const letras = partes.length === 1 ? partes[0]![0]! : partes[0]![0]! + partes[partes.length - 1]![0]!;
  return letras.toUpperCase();
}

function dinero(value: { toString(): string } | null): number | null {
  return value === null ? null : aPesos(aCentavos(value));
}

/**
 * Entry point for the page: authenticates, demands VER and loads the tab.
 * Lazy imports keep the pure parts of this file testable without NextAuth.
 */
export async function obtenerVistaConfiguracion(): Promise<VistaConfiguracion> {
  const actor = await requireCapacidad("VER");
  const [{ prisma }, { resolveLoginProfileImage }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/server/auth/login-profile-image"),
  ]);
  return cargarVistaConfiguracion(prisma, actor, resolveLoginProfileImage);
}

export async function cargarVistaConfiguracion(
  db: Db,
  actor: Pick<ActorCasaNegocio, "id" | "capacidades">,
  fotoDe: (email: string, image: string | null) => string | null = (_e, image) => image,
  ahora: Date = new Date(),
): Promise<VistaConfiguracion> {
  const [cuentasRows, asientos, origenes, destinos, asignadas, contadas, categoriasRows, porCategoria, configRow, reglasRows, usuarios] =
    await Promise.all([
      db.cnCuenta.findMany({ orderBy: [{ grupo: "asc" }, { orden: "asc" }, { nombre: "asc" }] }),
      cargarAsientos(db),
      db.cnMovimiento.groupBy({ by: ["cuentaOrigenId"], _count: { _all: true } }),
      db.cnMovimiento.groupBy({ by: ["cuentaDestinoId"], _count: { _all: true } }),
      db.cnAsignacionCuenta.groupBy({ by: ["cuentaId"], _count: { _all: true } }),
      db.cnArqueoDetalle.groupBy({ by: ["cuentaId"], _count: { _all: true } }),
      db.cnCategoriaGasto.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
      db.cnMovimiento.groupBy({ by: ["categoriaId"], where: { eliminadoEn: null }, _count: { _all: true } }),
      db.cnConfiguracion.findUniqueOrThrow({ where: { id: "default" } }),
      db.cnReglaAviso.findMany(),
      // Only existing Lopest users: active ones, plus inactive ones that still
      // hold a grant (so a leftover permission is visible and removable).
      db.user.findMany({
        where: { OR: [{ activo: true }, { cnPermisos: { some: {} } }] },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, email: true, photoUrl: true, activo: true, cnPermisos: { select: { capacidad: true } } },
      }),
    ]);

  const usadas = new Set<string>();
  for (const row of [...origenes.map((r) => r.cuentaOrigenId), ...destinos.map((r) => r.cuentaDestinoId)]) {
    if (row) usadas.add(row);
  }
  for (const row of [...asignadas, ...contadas]) usadas.add(row.cuentaId);

  const saldos = saldosActuales(cuentasRows, asientos);
  const movimientosPorCategoria = new Map(porCategoria.map((r) => [r.categoriaId, r._count._all]));
  const ordenAviso = (codigo: string) => CODIGOS_AVISO.indexOf(codigo as CodigoAviso);

  return {
    puedeConfigurar: actor.capacidades.has("CONFIGURAR"),
    hoy: fechaClave(ahora),
    cuentas: cuentasRows.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      grupo: c.grupo,
      tipo: c.tipo,
      orden: c.orden,
      archivada: c.archivada,
      saldoInicial: aPesos(aCentavos(c.saldoInicial)),
      fechaSaldoInicial: fechaClave(c.fechaSaldoInicial),
      saldoActual: saldos.get(c.id) ?? 0,
      tieneMovimientos: usadas.has(c.id),
      esCuentaAhorro: configRow.cuentaAhorroId === c.id,
      version: c.actualizadoEn.toISOString(),
    })),
    gastos: categoriasRows.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      clase: g.clase,
      monto: dinero(g.monto),
      periodicidad: g.periodicidad,
      mesAnual: g.mesAnual,
      diaPago: g.diaPago,
      activa: g.activa,
      orden: g.orden,
      movimientos: movimientosPorCategoria.get(g.id) ?? 0,
      version: g.actualizadoEn.toISOString(),
    })),
    configuracion: {
      metaAsignacionCasa: dinero(configRow.metaAsignacionCasa),
      metaAhorro: dinero(configRow.metaAhorro),
      cuentaAhorroId: configRow.cuentaAhorroId,
      version: configRow.actualizadoEn.toISOString(),
    },
    avisos: [...reglasRows]
      .sort((a, b) => ordenAviso(a.codigo) - ordenAviso(b.codigo))
      .map((r) => ({ codigo: r.codigo, activa: r.activa, umbral: r.umbral, version: r.actualizadoEn.toISOString() })),
    personas: usuarios.map((u) => ({
      userId: u.id,
      nombre: u.nombre,
      imagen: fotoDe(u.email, u.photoUrl),
      iniciales: inicialesDe(u.nombre),
      activo: u.activo,
      esUsted: u.id === actor.id,
      capacidades: CAPACIDADES.filter((c) => u.cnPermisos.some((p) => p.capacidad === (c as CnCapacidad))),
    })),
  };
}

// ---------------------------------------------------------------------------
// Action results
// ---------------------------------------------------------------------------

/** What every Configuración action returns to its client component. */
export type ResultadoAccion = { ok: true } | { ok: false; error: string; campos?: FieldErrors };

const MENSAJE_INESPERADO = "No se pudo guardar. Inténtalo de nuevo en un momento.";

/**
 * Runs a service and turns its failure into an inline error. Known errors
 * carry a message written for the person (permission, business rule, stale
 * version, invalid field); anything else is logged and replaced by a generic
 * message so internals never reach the browser.
 */
export async function ejecutarAccion(accion: string, servicio: () => Promise<unknown>): Promise<ResultadoAccion> {
  try {
    await servicio();
    return { ok: true };
  } catch (error) {
    // A lost session redirects to /login by throwing; let Next handle it.
    unstable_rethrow(error);
    if (error instanceof InputValidationError) return { ok: false, error: error.message, campos: error.fieldErrors };
    if (error instanceof CasaNegocioReglaError) {
      return { ok: false, error: error.message, campos: error.field ? { [error.field]: error.message } : undefined };
    }
    if (error instanceof CasaNegocioPermisoError || error instanceof ConcurrentModificationError) {
      return { ok: false, error: error.message };
    }
    logEvent("error", "casa_negocio.configuracion_fallida", { accion }, error);
    return { ok: false, error: MENSAJE_INESPERADO };
  }
}
