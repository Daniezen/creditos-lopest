/**
 * Pure presentation logic of the Configuración tab: labels, the subtitle of
 * each expense, the ten alert rules as the canvas words them, and the
 * capability toggling rule. No React, no server imports, so Vitest covers it
 * and the client components stay thin.
 */
import type { Capacidad, ClaseGasto, CodigoAviso, GrupoCuenta, Periodicidad, TipoCuenta } from "@/features/casa-negocio/types";

export const GRUPO_LABEL: Record<GrupoCuenta, string> = { NEGOCIO: "Negocio", CASA: "Casa" };

export const TIPO_LABEL: Record<TipoCuenta, string> = {
  EFECTIVO: "efectivo",
  BANCO: "banco",
  BILLETERA: "billetera",
  AHORRO: "ahorro",
};

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** Color bar of an account card: Casa teal, Ahorro gold, Negocio inks by kind (canvas). */
export type TonoCuenta = "efectivo" | "banco" | "billetera" | "casa" | "ahorro";

export function tonoCuenta(grupo: GrupoCuenta, tipo: TipoCuenta): TonoCuenta {
  if (tipo === "AHORRO") return "ahorro";
  if (grupo === "CASA") return "casa";
  if (tipo === "EFECTIVO") return "efectivo";
  if (tipo === "BILLETERA") return "billetera";
  return "banco";
}

/** «Negocio · efectivo». */
export function tipoCuentaTexto(grupo: GrupoCuenta, tipo: TipoCuenta): string {
  return `${GRUPO_LABEL[grupo]} · ${TIPO_LABEL[tipo]}`;
}

export const FALTA_DIA = "Falta día de pago";

export interface GastoTexto {
  clase: ClaseGasto;
  periodicidad: Periodicidad;
  mesAnual: number | null;
  diaPago: number | null;
  activa: boolean;
}

/**
 * Second line of an expense row, as the canvas words it:
 *   fijo mensual con día   «Cada mes · día 17»
 *   fijo anual             «Cada año · marzo» (+ « · día 5» when it has a day)
 *   fijo sin día           «Falta día de pago» (anual: «Cada año · marzo · falta día de pago»)
 *   variable               «Tope mensual»
 */
export function subtituloGasto(g: GastoTexto): { texto: string; faltaDia: boolean } {
  let texto: string;
  let faltaDia = false;
  if (g.clase === "VARIABLE") {
    texto = "Tope mensual";
  } else if (g.periodicidad === "ANUAL") {
    const mes = g.mesAnual ? MESES[g.mesAnual - 1] : "mes sin definir";
    faltaDia = g.diaPago === null;
    texto = `Cada año · ${mes}${g.diaPago ? ` · día ${g.diaPago}` : ` · ${FALTA_DIA.toLowerCase()}`}`;
  } else if (g.diaPago === null) {
    faltaDia = true;
    texto = FALTA_DIA;
  } else {
    texto = `Cada mes · día ${g.diaPago}`;
  }
  return { texto: g.activa ? texto : `${texto} · inactivo`, faltaDia };
}

/** Money as the inputs show it: «5.500.000», blank for null. */
export function montoEntrada(monto: number | null): string {
  return monto === null ? "" : Math.round(monto).toLocaleString("es-CO");
}

// ---------------------------------------------------------------------------
// Alert rules
// ---------------------------------------------------------------------------

export type NivelAviso = "atencion" | "problema";

export interface AvisoTexto {
  nivel: NivelAviso;
  /** Text before the threshold (the whole sentence when there is none). */
  antes: string;
  /** Text after the threshold; null for rules without one. */
  despues: string | null;
  donde: string;
}

/** The ten rules of spec §5 in their order, worded as the canvas. */
export const AVISOS: Record<CodigoAviso, AvisoTexto> = {
  FIJO_VENCIDO_SIN_PAGAR: { nivel: "problema", antes: "Un gasto fijo pasa su fecha sin pagar", despues: null, donde: "Tablero · Casa" },
  SOBRE_CERCA_DEL_TOPE: { nivel: "atencion", antes: "Un sobre llega al", despues: "% de su tope", donde: "Casa · Tablero" },
  SOBRES_CIERRE_NEGATIVO: {
    nivel: "atencion",
    antes: "Si se gasta lo que queda en los sobres, el mes cerraría en negativo",
    despues: null,
    donde: "Tablero",
  },
  CUENTA_SIN_CONTAR: { nivel: "atencion", antes: "Una cuenta lleva más de", despues: "días sin contar", donde: "Arqueo · Tablero" },
  ARQUEO_NO_CUADRA: { nivel: "problema", antes: "Un arqueo no cuadra", despues: null, donde: "Arqueo · Tablero" },
  RETIRO_SUPERA_GANANCIA: {
    nivel: "problema",
    antes: "En un mes se lleva a la casa más de lo que ganó el negocio",
    despues: null,
    donde: "Tablero · Resumen",
  },
  // The canvas says «Un préstamo … · Nuevo crédito»; Créditos is out of this
  // unit, so the rule is the spec's: any movement, warned where it is noted.
  MOVIMIENTO_DEJA_SIN_SALDO: { nivel: "problema", antes: "Un movimiento dejaría una cuenta sin saldo", despues: null, donde: "Anotar" },
  CREDITO_SIN_PAGOS: { nivel: "atencion", antes: "Un crédito lleva más de", despues: "días sin pagos", donde: "Tablero · Resumen" },
  GASTO_ANUAL_PROXIMO: { nivel: "atencion", antes: "Un gasto anual vence en menos de", despues: "días", donde: "Tablero · Casa" },
  CIERRE_SOBRANTE_SIN_AHORRO: {
    nivel: "atencion",
    antes: "Pasó el cierre y lo que sobró no está en el ahorro",
    despues: null,
    donde: "Ahorro · Tablero",
  },
};

export const NIVEL_LABEL: Record<NivelAviso, string> = { atencion: "Atención", problema: "Problema" };

/** Full sentence of a rule with its threshold, for accessible names. */
export function textoAviso(codigo: CodigoAviso, umbral: number | null): string {
  const a = AVISOS[codigo];
  return a.despues === null ? a.antes : `${a.antes} ${umbral ?? "N"} ${a.despues}`;
}

// ---------------------------------------------------------------------------
// Who can what
// ---------------------------------------------------------------------------

export const CAPACIDADES_COLUMNAS: ReadonlyArray<{ capacidad: Capacidad; label: string }> = [
  { capacidad: "VER", label: "Ver" },
  { capacidad: "ANOTAR", label: "Anotar" },
  { capacidad: "CONTAR", label: "Contar" },
  { capacidad: "CONFIGURAR", label: "Configurar" },
];

const ORDEN: readonly Capacidad[] = ["VER", "ANOTAR", "CONTAR", "CONFIGURAR"];

/**
 * The set after flipping one switch, mirroring the server rule (any
 * capability implies VER): turning anything on turns VER on; turning VER off
 * takes everything away, since without seeing the module nothing else works.
 */
export function alternarCapacidad(actuales: readonly Capacidad[], capacidad: Capacidad): Capacidad[] {
  const set = new Set(actuales);
  if (set.has(capacidad)) {
    if (capacidad === "VER") return [];
    set.delete(capacidad);
  } else {
    set.add(capacidad);
    set.add("VER");
  }
  return ORDEN.filter((c) => set.has(c));
}

/**
 * True when flipping this switch would take CONFIGURAR from the last person
 * who has it. The server refuses it anyway (configuracion.ts); the UI uses
 * this only to explain why before the round trip.
 */
export function quitariaUltimoConfigurador(
  personas: ReadonlyArray<{ userId: string; activo: boolean; capacidades: readonly Capacidad[] }>,
  userId: string,
  siguientes: readonly Capacidad[],
): boolean {
  if (siguientes.includes("CONFIGURAR")) return false;
  const persona = personas.find((p) => p.userId === userId);
  if (!persona?.capacidades.includes("CONFIGURAR")) return false;
  return !personas.some((p) => p.userId !== userId && p.activo && p.capacidades.includes("CONFIGURAR"));
}

export const ULTIMO_CONFIGURADOR =
  "Alguien tiene que poder configurar el módulo; da ese permiso a otra persona primero.";

// ---------------------------------------------------------------------------
// Account cards
// ---------------------------------------------------------------------------

/** «1 dic 2026» from a `AAAA-MM-DD` day (no time zone involved: it is a calendar day). */
export function diaConAnio(dia: string): string {
  const [anio, mes, d] = dia.split("-").map(Number);
  return `${d} ${MESES[mes - 1]?.slice(0, 3) ?? ""} ${anio}`;
}

/**
 * Third line of an account card: the opening balance and the day it was
 * counted («Inicial $ 1.320.000 · 1 dic 2026»). It is what the father types
 * on the first day, so a wrong figure is visible without opening the editor.
 */
export function saldoInicialTexto(saldoInicial: number, fecha: string): string {
  return `Inicial $ ${Math.round(saldoInicial).toLocaleString("es-CO")} · ${diaConAnio(fecha)}`;
}

/**
 * Whether «Es la cuenta de ahorro» starts ticked in the account editor: yes
 * when it already is, or when a new household savings account is created
 * and none is chosen yet (the usual 1-dic case: one savings account, Nu).
 */
export function ahorroMarcadoPorDefecto(
  cuenta: { esCuentaAhorro: boolean } | null,
  grupo: GrupoCuenta,
  tipo: TipoCuenta,
  cuentaAhorroId: string | null,
): boolean {
  if (cuenta) return cuenta.esCuentaAhorro;
  return grupo === "CASA" && tipo === "AHORRO" && cuentaAhorroId === null;
}
