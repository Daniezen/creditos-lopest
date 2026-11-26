/**
 * Ahorro tab (`Ahorro.dc.html`): its view model and the «Pasar al ahorro»
 * service of the month's cierre.
 *
 * THE CIERRE. What is left of the house at the end of the month is the Casa
 * equation's «al cierre» (entró − fijos − variables − fijos sin pagar,
 * spec §3), computed with the domain engine from the month read. «Pasar al
 * ahorro» moves it from a household account into the savings account set in
 * Configuración, through the phase-1 service `pasarAlAhorro` (TRASLADO,
 * capability `anotar`, audit, idempotency key).
 *
 * ONE CIERRE PER MONTH. The idempotency key is not random: it is derived on
 * the server from the month, `ahorro-cierre-<AAAA-MM>-<n>`, where n counts the
 * cierre movements of that month that were later voided. So
 *   - a double click, a second tab or a second person passing the same month
 *     land on the same key and the unique index returns the first movement
 *     (`repetido`) instead of moving the money twice;
 *   - once that movement is voided in Negocio/Casa, the next attempt uses the
 *     next n and the month can be passed again.
 * The same key prefix is how the tab knows which deposits belong to which
 * cierre, even when the cierre of November is passed on December 2nd.
 */
import { z } from "zod";

import {
  calcularCuentasCasa,
  evaluarAvisos,
  millones,
  nombreMes,
  porcentajeEntero,
  type CierreMesInput,
} from "@/features/casa-negocio/domain";
import { fechaClave, mesClave, parseMes } from "@/features/casa-negocio/mes";
import type { CasaNegocioMes, CuentaMes, FechaDia, Mes } from "@/features/casa-negocio/types";
import { entityId, moneyInput, parseInput } from "@/server/validation/input";

import { configAvisosSolo, estadoAvisosNeutro, nivelVista, type AvisoVista } from "./vista-arqueo";

// ---------------------------------------------------------------------------
// Cierre keys
// ---------------------------------------------------------------------------

const PREFIJO_CIERRE = "ahorro-cierre-";

/** Prefix shared by every attempt of a month's cierre. */
export function prefijoCierre(mes: Mes): string {
  return `${PREFIJO_CIERRE}${mes}-`;
}

/** Key of the next attempt, given how many earlier attempts were voided. */
export function claveCierre(mes: Mes, anulados: number): string {
  return `${prefijoCierre(mes)}${anulados}`;
}

/** Month a cierre key belongs to, or null for any other key. */
export function mesDeClaveCierre(clave: string | null): Mes | null {
  const m = clave?.match(/^ahorro-cierre-(\d{4}-\d{2})-\d+$/);
  return m ? m[1] : null;
}

/** A «Pasar al ahorro» movement of some month's cierre. */
export interface CierreAhorroRegistro {
  movimientoId: string;
  /** Month whose cierre it passed (from the key, not from its date). */
  mes: Mes;
  /** Day the transfer was recorded. */
  fecha: FechaDia;
  monto: number;
  anulado: boolean;
}

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface BarraAhorro {
  mes: Mes;
  /** «Nov». */
  etiqueta: string;
  /** Whole pesos that went into savings for that month. */
  valor: number;
  /** «7 M», «631 mil», «—». */
  texto: string;
  /** The selected month's cierre still to pass: drawn as an outline. */
  pendiente: boolean;
}

export interface OrigenCierre {
  id: string;
  nombre: string;
  saldo: number;
}

export type EstadoCierre =
  /** Something is left over and nothing was passed yet. */
  | "PENDIENTE"
  /** This month's cierre is already in savings. */
  | "HECHO"
  /** Nothing is left over (zero or negative). */
  | "NADA"
  /** No household account to take the money from. */
  | "SIN_ORIGEN"
  /** The month has not started yet. */
  | "FUTURO";

export interface CierreVista {
  mes: Mes;
  /** «Cierre de noviembre». */
  titulo: string;
  /** Casa «al cierre» of the month (may be negative). */
  sobrante: number;
  /** Amount offered to pass: the sobrante, never below zero. */
  propuesto: number;
  estado: EstadoCierre;
  hecho: { monto: number; fecha: FechaDia } | null;
  origenes: OrigenCierre[];
  /** Household account with the most money: the default origin. */
  origenId: string | null;
  /** Viewer holds `casa_negocio.anotar`. */
  puedePasar: boolean;
}

export type VistaAhorro =
  | { estado: "SIN_CUENTA"; puedeConfigurar: boolean }
  | {
      estado: "LISTO";
      puedeConfigurar: boolean;
      cuenta: { id: string; nombre: string; saldo: number };
      /** Null when no goal is set. */
      meta: { monto: number; porcentaje: number; falta: number } | null;
      cierre: CierreVista;
      barras: BarraAhorro[];
      avisos: AvisoVista[];
    };

/** «7 M», «2,5 M», «631 mil», «—» (canvas bar labels). */
export function textoBarra(valor: number): string {
  if (valor <= 0) return "—";
  if (valor >= 1_000_000) return millones(valor).replace(",0 M", " M");
  return `${Math.max(1, Math.round(valor / 1000))} mil`;
}

function etiquetaMes(mes: Mes): string {
  const nombre = nombreMes(mes);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1, 3);
}

/**
 * Casa «al cierre» of the month, with the same engine function the Tablero
 * uses. A fixed expense still owes what was not paid of it; one that does
 * not fall due this month owes nothing.
 */
export function sobranteCasa(data: CasaNegocioMes): number {
  const suma = (tipo: string) =>
    data.movimientos.filter((m) => m.tipo === tipo).reduce((total, m) => total + Math.round(m.monto), 0);
  const fijosSinPagar = data.categorias
    .filter((c) => c.clase === "FIJO" && c.activa && c.venceEnMes)
    .reduce((total, c) => total + Math.max(0, Math.round(c.monto ?? 0) - Math.round(c.gastadoMes)), 0);
  const casa = calcularCuentasCasa({
    ingresos: { retirosRecibidos: suma("RETIRO_CASA"), ingresosExtra: suma("INGRESO_CASA") },
    fijos: suma("GASTO_FIJO"),
    variables: suma("GASTO_VARIABLE"),
    fijosSinPagar,
    quedaEnSobres: 0,
  });
  return casa.alCierre;
}

export function construirVistaAhorro(
  data: CasaNegocioMes,
  cierres: readonly CierreAhorroRegistro[],
): VistaAhorro {
  const puedeConfigurar = data.usuario.capacidades.includes("CONFIGURAR");
  const cuentaAhorro = data.cuentas.find((c) => c.id === data.configuracion.cuentaAhorroId && !c.archivada);
  if (!cuentaAhorro) return { estado: "SIN_CUENTA", puedeConfigurar };

  // Balance at the end of the month looked at (today's, for the current month).
  const saldo = Math.round(cuentaAhorro.saldoFinMes);
  const metaMonto = data.configuracion.metaAhorro;
  const meta =
    metaMonto && metaMonto > 0
      ? {
          monto: Math.round(metaMonto),
          porcentaje: porcentajeEntero(Math.max(0, saldo), Math.round(metaMonto)) ?? 0,
          falta: Math.max(0, Math.round(metaMonto) - saldo),
        }
      : null;

  // The selected month's cierre.
  const mesActual = data.hoy.slice(0, 7);
  const vivos = cierres.filter((c) => !c.anulado);
  const hechoMes = vivos.filter((c) => c.mes === data.mes);
  const hecho =
    hechoMes.length > 0
      ? { monto: hechoMes.reduce((t, c) => t + Math.round(c.monto), 0), fecha: hechoMes[hechoMes.length - 1].fecha }
      : null;
  const origenes: OrigenCierre[] = data.cuentas
    .filter((c: CuentaMes) => c.grupo === "CASA" && !c.archivada && c.tipo !== "AHORRO" && c.id !== cuentaAhorro.id)
    .map((c) => ({ id: c.id, nombre: c.nombre, saldo: Math.round(c.saldoActual) }));
  const origenId = [...origenes].sort((a, b) => b.saldo - a.saldo)[0]?.id ?? null;
  const sobrante = data.mes > mesActual ? 0 : sobranteCasa(data);
  const propuesto = Math.max(0, sobrante);
  const estado: EstadoCierre =
    data.mes > mesActual ? "FUTURO" : hecho ? "HECHO" : propuesto <= 0 ? "NADA" : origenId ? "PENDIENTE" : "SIN_ORIGEN";

  const cierre: CierreVista = {
    mes: data.mes,
    titulo: `Cierre de ${nombreMes(data.mes)}`,
    sobrante,
    propuesto,
    estado,
    hecho,
    origenes,
    origenId,
    puedePasar: data.usuario.capacidades.includes("ANOTAR"),
  };

  // Bars: what went into savings each month. Cierre transfers count for the
  // month they closed, not the day they were made; every other deposit by date.
  const barras: BarraAhorro[] = data.historial.map((h) => {
    const cierresConFecha = vivos.filter((c) => c.fecha.slice(0, 7) === h.mes).reduce((t, c) => t + c.monto, 0);
    const cierresDelMes = vivos.filter((c) => c.mes === h.mes).reduce((t, c) => t + c.monto, 0);
    const real = Math.max(0, Math.round(h.depositosAhorro - cierresConFecha + cierresDelMes));
    const pendiente = h.mes === data.mes && estado === "PENDIENTE";
    const valor = pendiente ? real + propuesto : real;
    return { mes: h.mes, etiqueta: etiquetaMes(h.mes), valor, texto: textoBarra(valor), pendiente };
  });

  // Aviso 10: the month already ended and its sobrante is not in savings.
  const cierreAnterior: CierreMesInput | null =
    data.mes < mesActual ? { mes: data.mes, sobrante, pasadoAlAhorro: hecho?.monto ?? 0 } : null;
  const avisos = evaluarAvisos(
    { ...estadoAvisosNeutro(data.mes, data.hoy), cierreAnterior },
    configAvisosSolo(data.configuracion.reglas, ["CIERRE_SIN_AHORRO"]),
  ).map((a) => ({ nivel: nivelVista(a.nivel), texto: a.texto, elemento: a.elemento }));

  return {
    estado: "LISTO",
    puedeConfigurar,
    cuenta: { id: cuentaAhorro.id, nombre: cuentaAhorro.nombre, saldo },
    meta,
    cierre,
    barras,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Reads and the «Pasar al ahorro» service
// ---------------------------------------------------------------------------

/** Minimal client surface, so the service tests can pass a stub. */
type MovimientosCierre = {
  cnMovimiento: {
    findMany(args: {
      where: { idempotencyKey: { startsWith: string } };
      select: { id: true; idempotencyKey: true; fecha: true; monto: true; eliminadoEn: true };
    }): Promise<
      { id: string; idempotencyKey: string | null; fecha: Date; monto: { toString(): string }; eliminadoEn: Date | null }[]
    >;
  };
};

/** Every cierre movement whose key starts with `prefijo` (all months by default). */
export async function leerCierresAhorro(db: MovimientosCierre, prefijo = PREFIJO_CIERRE): Promise<CierreAhorroRegistro[]> {
  const rows = await db.cnMovimiento.findMany({
    where: { idempotencyKey: { startsWith: prefijo } },
    select: { id: true, idempotencyKey: true, fecha: true, monto: true, eliminadoEn: true },
  });
  return rows.flatMap((r) => {
    const mes = mesDeClaveCierre(r.idempotencyKey);
    if (!mes) return [];
    return [{ movimientoId: r.id, mes, fecha: fechaClave(r.fecha), monto: Number(r.monto.toString()), anulado: r.eliminadoEn !== null }];
  });
}

/** For the page: the cierre movements, behind `casa_negocio.ver`. */
export async function obtenerCierresAhorro(): Promise<CierreAhorroRegistro[]> {
  const [{ requireCapacidad }, { prisma }] = await Promise.all([import("./capacidades"), import("@/lib/prisma")]);
  await requireCapacidad("VER");
  return leerCierresAhorro(prisma as unknown as MovimientosCierre);
}

const mesSchema = z
  .string({ error: "Falta el mes." })
  .trim()
  .refine((v) => parseMes(v) !== null, { error: "El mes no es válido (AAAA-MM)." });

export const pasarCierreSchema = z.object({
  mes: mesSchema,
  cuentaOrigenId: entityId("la cuenta de origen"),
  monto: moneyInput({ required: "Falta el monto.", invalid: "El monto debe ser mayor que cero." }),
});

export interface ResultadoCierre {
  movimientoId: string;
  /** True when this month's cierre had already been passed: nothing new was moved. */
  repetido: boolean;
  monto: number;
}

/** Colombian text of an amount, as `moneyInput` reads it back («631000,50»). */
function montoTexto(monto: number): string {
  return monto.toFixed(2).replace(".", ",");
}

/**
 * «Pasar al ahorro» of a month's cierre. Capability `anotar` first, then the
 * input, then the once-per-month check; the transfer itself is the phase-1
 * `pasarAlAhorro`, which validates the accounts, audits and enforces the key.
 */
export async function pasarCierreAlAhorro(raw: unknown, ahora: Date = new Date()): Promise<ResultadoCierre> {
  const [{ requireCapacidad }, { prisma }, { pasarAlAhorro }, { cargarAsientos, saldosActuales }, { CasaNegocioReglaError }] =
    await Promise.all([
      import("./capacidades"),
      import("@/lib/prisma"),
      import("./movimientos"),
      import("./saldos"),
      import("./errors"),
    ]);
  await requireCapacidad("ANOTAR");
  const { mes, cuentaOrigenId, monto } = parseInput(pasarCierreSchema, raw);
  if (mes > mesClave(ahora)) throw new CasaNegocioReglaError("Ese mes todavía no empieza.");

  const intentos = await leerCierresAhorro(prisma as unknown as MovimientosCierre, prefijoCierre(mes));
  const vivo = intentos.find((c) => !c.anulado);
  if (vivo) return { movimientoId: vivo.movimientoId, repetido: true, monto: vivo.monto };

  // The money must be there: a cierre never leaves the household account below zero.
  const origen = await prisma.cnCuenta.findUnique({
    where: { id: cuentaOrigenId },
    select: { id: true, nombre: true, grupo: true, saldoInicial: true, fechaSaldoInicial: true },
  });
  if (!origen) throw new CasaNegocioReglaError("La cuenta de origen no existe.", "cuentaOrigenId");
  if (origen.grupo !== "CASA") throw new CasaNegocioReglaError("El cierre sale de una cuenta de la casa.", "cuentaOrigenId");
  const saldo = saldosActuales([origen], await cargarAsientos(prisma, [origen.id])).get(origen.id) ?? 0;
  if (monto > saldo) {
    throw new CasaNegocioReglaError(`${origen.nombre} no tiene ese monto; hoy tiene ${Math.round(saldo).toLocaleString("es-CO")}.`, "monto");
  }

  const resultado = await pasarAlAhorro({
    operationKey: claveCierre(mes, intentos.length),
    cuentaOrigenId,
    monto: montoTexto(monto),
    fecha: fechaClave(ahora),
    nota: `Cierre de ${nombreMes(mes)}`,
  });
  return { movimientoId: resultado.movimientoId, repetido: resultado.repetido, monto };
}
