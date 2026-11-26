/**
 * View model of the Arqueo tab (`Arqueo.dc.html`), built from the month read
 * (`CasaNegocioMes`). Pure: no I/O, so the page, the client component and the
 * tests all see the same numbers.
 *
 * What the tab needs and where it comes from:
 *   - «Lopest dice» per account: `CuentaMes.saldoActual`. An arqueo always
 *     counts what is in the account NOW, whatever month the header shows; the
 *     server recomputes it again inside the save transaction anyway.
 *   - The live result while typing: the domain engine (`arquear`), run on the
 *     client with these balances.
 *   - History chips and avisos 4 and 5: from `CasaNegocioMes.arqueos` (latest
 *     24) and the domain's `evaluarAvisos`, fed only what those two rules read.
 *
 * Money enters the engine as whole pesos (`assertPesos`); balances carrying
 * centavos are rounded here, the save keeps the exact value server-side.
 */
import {
  calcularCuentasCasa,
  calcularCuentasNegocio,
  diaBogota,
  evaluarAvisos,
  NOMBRES_MES,
  partesDia,
  pesos,
  type ConfigAvisos,
  type CuentaConteoInput,
  type EstadoAvisosInput,
  type ReglaAvisoId,
} from "@/features/casa-negocio/domain";
import type { CasaNegocioMes, CodigoAviso, GrupoCuenta, ReglaAviso } from "@/features/casa-negocio/types";
import { logEvent } from "@/server/observability/log";

/** Notice of spec §5 as the tabs draw it (`Notice` component levels). */
export interface AvisoVista {
  nivel: "atencion" | "problema";
  texto: string;
  /** Element it belongs to (`cuenta:<id>`, `cierre:<mes>`). */
  elemento: string;
}

export interface CuentaArqueoVista {
  cuentaId: string;
  nombre: string;
  grupo: GrupoCuenta;
  /** «Lopest dice», whole pesos. */
  saldoSistema: number;
  saldoTexto: string;
  /** Day of the last arqueo that counted it, null if never counted. */
  ultimoConteo: string | null;
}

export interface GrupoArqueoVista {
  grupo: GrupoCuenta;
  etiqueta: "Negocio" | "Casa";
  cuentas: CuentaArqueoVista[];
}

export interface HistorialArqueoVista {
  id: string;
  /** «23 nov · Nequi −$ 50.000», «20 nov · cuadró». */
  texto: string;
  /** ok = everything matched; problema = something was missing; atencion = only surpluses. */
  tono: "ok" | "problema" | "atencion";
}

export interface VistaArqueo {
  puedeContar: boolean;
  puedeConfigurar: boolean;
  /** Active accounts in canvas order, Negocio first; empty groups are left out. */
  grupos: GrupoArqueoVista[];
  totalCuentas: number;
  historial: HistorialArqueoVista[];
  avisos: AvisoVista[];
}

const HISTORIAL_VISIBLE = 6;

/** Domain rule id of each stored rule code (the two catalogues were named apart). */
const REGLA_DOMINIO: Record<CodigoAviso, ReglaAvisoId> = {
  FIJO_VENCIDO_SIN_PAGAR: "FIJO_VENCIDO",
  SOBRE_CERCA_DEL_TOPE: "SOBRE_CERCA_TOPE",
  SOBRES_CIERRE_NEGATIVO: "SOBRES_CIERRE_NEGATIVO",
  CUENTA_SIN_CONTAR: "CUENTA_SIN_CONTAR",
  ARQUEO_NO_CUADRA: "ARQUEO_NO_CUADRA",
  RETIRO_SUPERA_GANANCIA: "RETIRO_MAYOR_GANANCIA",
  MOVIMIENTO_DEJA_SIN_SALDO: "CUENTA_SIN_SALDO",
  CREDITO_SIN_PAGOS: "CREDITO_SIN_PAGOS",
  GASTO_ANUAL_PROXIMO: "ANUAL_POR_VENCER",
  CIERRE_SOBRANTE_SIN_AHORRO: "CIERRE_SIN_AHORRO",
};

/**
 * Engine config that keeps ONLY `solo` active, each with the switch and
 * threshold stored in Configuración. Every other rule is switched off, so the
 * neutral state below never produces a notice that belongs to another tab.
 */
export function configAvisosSolo(reglas: readonly ReglaAviso[], solo: readonly ReglaAvisoId[]): ConfigAvisos {
  const config: ConfigAvisos = {};
  for (const id of Object.values(REGLA_DOMINIO)) config[id] = { activa: false };
  for (const id of solo) config[id] = { activa: true };
  for (const r of reglas) {
    const id = REGLA_DOMINIO[r.codigo];
    if (!solo.includes(id)) continue;
    config[id] = { activa: r.activa, umbral: r.umbral ?? undefined };
  }
  return config;
}

/** Evaluation input with nothing in it; callers fill the fields their rules read. */
export function estadoAvisosNeutro(mes: string, hoy: string): EstadoAvisosInput {
  const ceros = { interesesCobrados: 0, gastos: 0, perdidos: 0, retirosCasa: 0 };
  return {
    mes,
    hoy,
    fijos: [],
    sobres: [],
    casa: calcularCuentasCasa({
      ingresos: { retirosRecibidos: 0, ingresosExtra: 0 },
      fijos: 0,
      variables: 0,
      fijosSinPagar: 0,
      quedaEnSobres: 0,
    }),
    cuentas: [],
    negocio: calcularCuentasNegocio(ceros),
    creditos: [],
    gastosFijos: [],
    pagosFijos: [],
    cierreAnterior: null,
  };
}

/** Engine level → `Notice` level. */
export function nivelVista(nivel: "ATENCION" | "PROBLEMA"): AvisoVista["nivel"] {
  return nivel === "PROBLEMA" ? "problema" : "atencion";
}

/** «23 nov». */
export function diaCorto(dia: string): string {
  const p = partesDia(dia);
  return `${p.dia} ${NOMBRES_MES[p.mes - 1].slice(0, 3)}`;
}

/** «−$ 50.000» / «+$ 20.000», the signed difference of a history chip. */
function diferenciaFirmada(diferencia: number): string {
  return diferencia < 0 ? pesos(diferencia) : `+${pesos(diferencia)}`;
}

export function construirVistaArqueo(data: CasaNegocioMes): VistaArqueo {
  const activas = data.cuentas.filter((c) => !c.archivada);
  const nombres = new Map(data.cuentas.map((c) => [c.id, c.nombre]));

  // Latest arqueo that counted each account (arqueos come most recent first).
  const ultimo = new Map<string, { fecha: string; diferencia: number }>();
  for (const a of data.arqueos) {
    for (const d of a.detalles) {
      if (!ultimo.has(d.cuentaId)) ultimo.set(d.cuentaId, { fecha: diaBogota(new Date(a.fecha)), diferencia: Math.round(d.diferencia) });
    }
  }

  const vistaCuenta = (c: CasaNegocioMes["cuentas"][number]): CuentaArqueoVista => {
    const saldoSistema = Math.round(c.saldoActual);
    return {
      cuentaId: c.id,
      nombre: c.nombre,
      grupo: c.grupo,
      saldoSistema,
      saldoTexto: pesos(saldoSistema),
      ultimoConteo: c.ultimoArqueo ? diaBogota(new Date(c.ultimoArqueo)) : null,
    };
  };

  const grupos: GrupoArqueoVista[] = (
    [
      { grupo: "NEGOCIO", etiqueta: "Negocio" },
      { grupo: "CASA", etiqueta: "Casa" },
    ] as const
  )
    .map((g) => ({ ...g, cuentas: activas.filter((c) => c.grupo === g.grupo).map(vistaCuenta) }))
    .filter((g) => g.cuentas.length > 0);

  const historial: HistorialArqueoVista[] = data.arqueos.slice(0, HISTORIAL_VISIBLE).map((a) => {
    const dia = diaCorto(diaBogota(new Date(a.fecha)));
    const descuadres = a.detalles.filter((d) => Math.round(d.diferencia) !== 0);
    if (descuadres.length === 0) return { id: a.id, texto: `${dia} · cuadró`, tono: "ok" };
    const partes = descuadres.map(
      (d) => `${nombres.get(d.cuentaId) ?? "Cuenta"} ${diferenciaFirmada(Math.round(d.diferencia))}`,
    );
    return {
      id: a.id,
      texto: `${dia} · ${partes.join(" · ")}`,
      tono: descuadres.some((d) => d.diferencia < 0) ? "problema" : "atencion",
    };
  });

  // Avisos 4 (sin contar hace más de N días) and 5 (el último arqueo no cuadró).
  const cuentasConteo: CuentaConteoInput[] = activas.map((c) => ({
    cuentaId: c.id,
    nombre: c.nombre,
    desde: c.fechaSaldoInicial,
    ultimoArqueo: ultimo.get(c.id) ?? (c.ultimoArqueo ? { fecha: diaBogota(new Date(c.ultimoArqueo)), diferencia: 0 } : null),
  }));
  const avisos = evaluarAvisos(
    { ...estadoAvisosNeutro(data.mes, data.hoy), cuentas: cuentasConteo },
    configAvisosSolo(data.configuracion.reglas, ["CUENTA_SIN_CONTAR", "ARQUEO_NO_CUADRA"]),
  )
    // Problems first, as the canvas reads top to bottom by severity.
    .sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "PROBLEMA" ? -1 : 1))
    .map((a) => ({ nivel: nivelVista(a.nivel), texto: a.texto, elemento: a.elemento }));

  return {
    puedeContar: data.usuario.capacidades.includes("CONTAR"),
    puedeConfigurar: data.usuario.capacidades.includes("CONFIGURAR"),
    grupos,
    totalCuentas: activas.length,
    historial,
    avisos,
  };
}

/**
 * What a person typed in «Contaste» → whole pesos, or null while empty.
 * Accepts «1.320.000», «$ 1.320.000» and «1320000»; centavos after a comma
 * are rounded (cash is counted in pesos). Anything unreadable is null, so
 * the card stays «Por contar» instead of showing a false difference.
 */
export function leerContado(texto: string): number | null {
  const limpio = texto.trim().replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (limpio === "" || !/^\d+(\.\d{0,2})?$/.test(limpio)) return null;
  return Math.round(Number(limpio));
}

// ---------------------------------------------------------------------------
// Action results (shared by the Ahorro and Arqueo server actions)
// ---------------------------------------------------------------------------

/** What a tab's server action returns to its form: plain data, never an Error. */
export type ResultadoAccion<T = undefined> =
  | { ok: true; mensaje: string; datos: T }
  | { ok: false; mensaje: string; campo?: string };

/**
 * Turns a service failure into the message shown beside the form. The
 * module's own errors and the validation/optimistic-lock errors already carry
 * text written for the person; anything else is unexpected, logged on the
 * server and replaced by a generic message (no internals reach the browser).
 */
export function fallaDeAccion(
  error: unknown,
  conocidos: readonly (abstract new (...args: never[]) => Error)[],
): { ok: false; mensaje: string; campo?: string } {
  if (conocidos.some((Clase) => error instanceof Clase)) {
    const campo = (error as { field?: string }).field;
    return campo ? { ok: false, mensaje: (error as Error).message, campo } : { ok: false, mensaje: (error as Error).message };
  }
  logEvent("error", "casa_negocio.accion_fallida", {}, error);
  return { ok: false, mensaje: "No se pudo guardar. Intenta de nuevo en un momento." };
}
