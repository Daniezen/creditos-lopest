/**
 * «Anotar» (the quick entry panel of the common header): form contract,
 * zod validation and the translation to `registrarMovimiento`'s input.
 *
 * CLIENT-SAFE: no server imports, so the panel could reuse the same schema
 * for inline checks; the Server Action (`anotar-actions.ts`) always parses
 * again on the server, and the service (`registrarMovimiento`) parses a third
 * time with its own schema and applies the database rules (account groups,
 * archived accounts, opening dates). Each layer guards what it knows.
 *
 * FIELD NAMES. The panel posts `tipo`, `operationKey`, `monto`, `fecha` and
 * the two selects of the chosen kind (`components/casa-negocio/header/
 * quick-entry.ts`): `categoria`, `cuentaOrigen`, `cuentaDestino`, `origen`,
 * `concepto`. Errors come back keyed by these same names so each message
 * lands next to its own field, including the ones the service raises
 * (`cuentaOrigenId` → `cuentaOrigen`, see `campoDelPanel`).
 */
import { z } from "zod";

import { moneyInput, operationKey, pastOrTodayDateInput } from "@/server/validation/input";

import type { RegistrarMovimientoInput } from "./schemas";

export const TIPOS_ANOTAR = ["gastoCasa", "ingresoCasa", "gastoNegocio", "aporte", "retiro", "traslado"] as const;
export type TipoAnotar = (typeof TIPOS_ANOTAR)[number];

/** Every name the panel may post. */
export const CAMPOS_ANOTAR = [
  "tipo",
  "operationKey",
  "monto",
  "fecha",
  "categoria",
  "cuentaOrigen",
  "cuentaDestino",
  "origen",
  "concepto",
] as const;
export type CampoAnotar = (typeof CAMPOS_ANOTAR)[number];

/**
 * Prefix of an «origen» option that is an account («Desde Cuenta casa»).
 * Any other origin value is free text stored as the movement's note
 * («Arriendo recibido», «Ahorros propios»).
 */
export const PREFIJO_CUENTA = "cuenta:";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function eleccion(mensaje: string) {
  return z.string({ error: mensaje }).trim().regex(ID, mensaje);
}

function texto(mensaje: string) {
  return z.string({ error: mensaje }).trim().min(1, mensaje).max(120, "Máximo 120 caracteres.");
}

const comunes = {
  operationKey,
  monto: moneyInput({ required: "Escribe el monto.", invalid: "El monto debe ser mayor que cero." }),
  fecha: pastOrTodayDateInput("la fecha", "La fecha no puede ser posterior a hoy."),
};

const distintas = (data: { cuentaOrigen: string; cuentaDestino: string }) => data.cuentaOrigen !== data.cuentaDestino;
const MISMA_CUENTA = { error: "Elige una cuenta distinta a la de salida.", path: ["cuentaDestino"] };

export const anotarSchema = z.discriminatedUnion(
  "tipo",
  [
    z.object({
      tipo: z.literal("gastoCasa"),
      categoria: eleccion("Elige la categoría."),
      cuentaOrigen: eleccion("Elige de dónde se pagó."),
      ...comunes,
    }),
    z.object({
      tipo: z.literal("ingresoCasa"),
      origen: texto("Elige de dónde viene."),
      cuentaDestino: eleccion("Elige dónde se recibió."),
      ...comunes,
    }),
    z.object({
      tipo: z.literal("gastoNegocio"),
      concepto: texto("Elige el concepto."),
      cuentaOrigen: eleccion("Elige de dónde se pagó."),
      ...comunes,
    }),
    z.object({
      tipo: z.literal("aporte"),
      origen: texto("Elige de dónde viene."),
      cuentaDestino: eleccion("Elige dónde se recibió."),
      ...comunes,
    }),
    z
      .object({
        tipo: z.literal("retiro"),
        cuentaOrigen: eleccion("Elige de qué cuenta sale."),
        cuentaDestino: eleccion("Elige a qué cuenta llega."),
        ...comunes,
      })
      .refine(distintas, MISMA_CUENTA),
    z
      .object({
        tipo: z.literal("traslado"),
        cuentaOrigen: eleccion("Elige de qué cuenta sale."),
        cuentaDestino: eleccion("Elige a qué cuenta llega."),
        ...comunes,
      })
      .refine(distintas, MISMA_CUENTA),
  ],
  { error: "Elige el tipo de movimiento." },
);
export type AnotarEntrada = z.output<typeof anotarSchema>;

/**
 * Builds `registrarMovimiento`'s raw input from the panel's raw fields (once
 * `anotarSchema` accepted them). The service receives the original text of
 * `monto`/`fecha` so its own parser is the one that decides the stored value.
 *
 * A house expense is sent as GASTO_VARIABLE: the service files it under the
 * class its category has today (FIJO or VARIABLE), so the panel never needs
 * to know the class.
 */
export function aRegistroMovimiento(
  entrada: AnotarEntrada,
  raw: Partial<Record<CampoAnotar, string | undefined>>,
): RegistrarMovimientoInput {
  const base = { operationKey: entrada.operationKey, monto: raw.monto ?? "", fecha: raw.fecha ?? "" };
  switch (entrada.tipo) {
    case "gastoCasa":
      return { ...base, tipo: "GASTO_VARIABLE", categoriaId: entrada.categoria, cuentaOrigenId: entrada.cuentaOrigen };
    case "ingresoCasa":
      return { ...base, tipo: "INGRESO_CASA", cuentaDestinoId: entrada.cuentaDestino, nota: entrada.origen };
    case "gastoNegocio":
      return { ...base, tipo: "GASTO_NEGOCIO", cuentaOrigenId: entrada.cuentaOrigen, nota: entrada.concepto };
    case "aporte":
      return entrada.origen.startsWith(PREFIJO_CUENTA)
        ? { ...base, tipo: "APORTE", cuentaDestinoId: entrada.cuentaDestino, cuentaOrigenId: entrada.origen.slice(PREFIJO_CUENTA.length) }
        : { ...base, tipo: "APORTE", cuentaDestinoId: entrada.cuentaDestino, nota: entrada.origen };
    case "retiro":
      return { ...base, tipo: "RETIRO_CASA", cuentaOrigenId: entrada.cuentaOrigen, cuentaDestinoId: entrada.cuentaDestino };
    case "traslado":
      return { ...base, tipo: "TRASLADO", cuentaOrigenId: entrada.cuentaOrigen, cuentaDestinoId: entrada.cuentaDestino };
  }
}

/**
 * Panel field that shows a service error about `campo` (a field of
 * `registrarMovimientoSchema`), or null when it is not about one field.
 */
export function campoDelPanel(tipo: string | undefined, campo: string | undefined): CampoAnotar | null {
  switch (campo) {
    case "monto":
    case "fecha":
      return campo;
    case "categoriaId":
      return "categoria";
    case "cuentaOrigenId":
      return tipo === "aporte" ? "origen" : "cuentaOrigen";
    case "cuentaDestinoId":
      return "cuentaDestino";
    case "nota":
      return tipo === "gastoNegocio" ? "concepto" : "origen";
    default:
      return null;
  }
}

/** What the Server Action returns to the panel (`useActionState`). */
export interface AnotarEstado {
  status: "idle" | "ok" | "error";
  /** General message (permission, unexpected failure); field messages go in `fieldErrors`. */
  message: string | null;
  fieldErrors?: Partial<Record<CampoAnotar, string>>;
  /** Increases on every successful save, so the panel can react once per save. */
  guardados: number;
}

export const ANOTAR_ESTADO_INICIAL: AnotarEstado = { status: "idle", message: null, guardados: 0 };
