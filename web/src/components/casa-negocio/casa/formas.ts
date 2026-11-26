/**
 * Which fields each manual movement kind asks for, in the order the canvas
 * draws them, and what each field is called. Mirrors the shape table of
 * `server/casa-negocio/rules.ts` (the server is still the guard): a field
 * that is not listed is sent empty, so a stale value from another kind is
 * never submitted.
 *
 * Pure module, shared by «Anotar en la casa», «Anotar en el negocio» and the
 * edit dialog.
 */
import type { TipoMovimiento } from "@/features/casa-negocio/types";

/**
 * Attribute of a book container (Casa's day cards, Negocio's cash book) that
 * takes the focus when the row whose dialog closed is no longer on the page.
 * Lives in this plain module, not in the client dialog: a constant imported
 * from a "use client" file into a Server Component is a client reference,
 * not the string.
 */
export const MARCA_LIBRO = "data-libro";

export type GrupoCampo = "NEGOCIO" | "CASA";

export interface FormaMovimiento {
  /** Account the money leaves, with its label; null when the kind has none. */
  origen: { grupo: GrupoCampo; label: string } | null;
  destino: { grupo: GrupoCampo; label: string } | null;
  /** Household category the kind needs. */
  categoria: { clase: "FIJO" | "VARIABLE"; label: string } | null;
  /** Free text: «Nota», or «De dónde» for household income. */
  nota: { label: string; placeholder: string; sugerencias?: readonly string[] } | null;
  /** Kind that moves money out of `origen` (alert 7 applies). */
  sale: boolean;
}

export const FORMAS: Record<TipoMovimiento, FormaMovimiento> = {
  GASTO_FIJO: {
    origen: { grupo: "CASA", label: "Pagado desde" },
    destino: null,
    categoria: { clase: "FIJO", label: "Gasto fijo" },
    nota: null,
    sale: true,
  },
  GASTO_VARIABLE: {
    origen: { grupo: "CASA", label: "Pagado desde" },
    destino: null,
    categoria: { clase: "VARIABLE", label: "Sobre" },
    nota: null,
    sale: true,
  },
  INGRESO_CASA: {
    origen: null,
    destino: { grupo: "CASA", label: "Recibido en" },
    categoria: null,
    nota: { label: "De dónde", placeholder: "Arriendo recibido, regalo…", sugerencias: ["Arriendo recibido", "Regalo", "Otro"] },
    sale: false,
  },
  GASTO_NEGOCIO: {
    origen: { grupo: "NEGOCIO", label: "Pagado desde" },
    destino: null,
    categoria: null,
    nota: { label: "Nota", placeholder: "Papelería, transporte…" },
    sale: true,
  },
  APORTE: {
    origen: null,
    destino: { grupo: "NEGOCIO", label: "Recibido en" },
    categoria: null,
    nota: { label: "Nota", placeholder: "De dónde viene" },
    sale: false,
  },
  RETIRO_CASA: {
    origen: { grupo: "NEGOCIO", label: "Sale de" },
    destino: { grupo: "CASA", label: "Llega a" },
    categoria: null,
    nota: { label: "Nota", placeholder: "Opcional" },
    sale: true,
  },
  TRASLADO: {
    origen: { grupo: "NEGOCIO", label: "Sale de" },
    destino: { grupo: "NEGOCIO", label: "Llega a" },
    categoria: null,
    nota: { label: "Nota", placeholder: "Consignación…" },
    sale: true,
  },
};

/** The form's values, as text, exactly what the zod schema parses. */
export interface ValoresMovimiento {
  tipo: TipoMovimiento;
  fecha: string;
  monto: string;
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  categoriaId: string;
  nota: string;
}

/** Drops the fields the kind does not use, so they reach the server empty. */
export function payloadDe(v: ValoresMovimiento): Record<string, string> {
  const forma = FORMAS[v.tipo];
  return {
    tipo: v.tipo,
    fecha: v.fecha,
    monto: v.monto,
    cuentaOrigenId: forma.origen ? v.cuentaOrigenId : "",
    cuentaDestinoId: forma.destino ? v.cuentaDestinoId : "",
    categoriaId: forma.categoria ? v.categoriaId : "",
    nota: forma.nota ? v.nota : "",
  };
}

/**
 * Live grouping of a typed amount, es-CO style: digits grouped with «.»,
 * one «,» for cents (at most two). «1787000» → «1.787.000».
 */
export function formatearMonto(raw: string): string {
  const limpio = raw.replace(/[^\d,]/g, "");
  const [entero, ...resto] = limpio.split(",");
  const digitos = entero.replace(/^0+(?=\d)/, "");
  const agrupado = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (resto.length === 0) return agrupado;
  return `${agrupado || "0"},${resto.join("").slice(0, 2)}`;
}

/**
 * A PASTED amount (from a bank SMS, a spreadsheet, a calculator) rewritten
 * as the field types it. Pasted text can use either convention, so the
 * separators are read by shape instead of by the es-CO rule:
 *
 * - both «.» and «,» present: the last one is the decimal mark
 *   («1,787,000.50» and «1.787.000,50» are the same amount);
 * - one kind repeated («1,787,000», «1.787.000»): thousands;
 * - a single mark followed by exactly three digits («1,500», «1.500»):
 *   thousands — pesos with a fractional part of three digits do not exist;
 * - a single mark followed by one or two digits («1787000.5»): decimals.
 *
 * Only paste goes through here. While typing, `formatearMonto` keeps the
 * plain es-CO rule: a half-typed «1.78» (after a backspace) must stay a
 * thousands grouping, never become one peso seventy-eight.
 */
export function normalizarPegado(raw: string): string {
  const limpio = raw.replace(/[^\d.,]/g, "");
  const ultimoPunto = limpio.lastIndexOf(".");
  const ultimaComa = limpio.lastIndexOf(",");
  let decimal: "." | "," | null = null;
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    decimal = ultimoPunto > ultimaComa ? "." : ",";
  } else {
    const marca = ultimoPunto >= 0 ? "." : ultimaComa >= 0 ? "," : null;
    if (marca && limpio.split(marca).length === 2) {
      const despues = limpio.slice(limpio.lastIndexOf(marca) + 1);
      if (despues.length === 1 || despues.length === 2) decimal = marca;
    }
  }
  if (!decimal) return formatearMonto(limpio.replace(/[.,]/g, ""));
  const corte = limpio.lastIndexOf(decimal);
  const entero = limpio.slice(0, corte).replace(/[.,]/g, "");
  const fraccion = limpio.slice(corte + 1).replace(/[.,]/g, "");
  return formatearMonto(`${entero},${fraccion}`);
}

/** A stored amount as the money field shows it. */
export function montoInicial(monto: number): string {
  const [entero, decimales] = monto.toFixed(2).split(".");
  const base = formatearMonto(entero);
  return decimales === "00" ? base : `${base},${decimales}`;
}

/** The typed amount as a number of pesos (NaN while empty or invalid). */
export function montoNumero(texto: string): number {
  if (!texto.trim()) return Number.NaN;
  return Number(texto.replace(/\./g, "").replace(",", "."));
}
