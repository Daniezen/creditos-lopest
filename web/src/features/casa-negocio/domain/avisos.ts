import type { CuentasCasa, CuentasNegocio } from "./cuentas-mes";
import { aDia, compararDias, diaDelMes, diaEnMes, diferenciaDias, mesDe, nombreMes, partesDia, ultimoDia } from "./dates";
import type { FijoDelMes, SobreDelMes } from "./fijos-sobres";
import type {
  CierreMesInput,
  CreditoCarteraInput,
  CuentaConteoInput,
  DiaISO,
  GastoFijoInput,
  MesISO,
  PagoFijoInput,
  Pesos,
  SalidaPropuestaInput,
} from "./inputs";
import { sumarPesos } from "./money";
import { diasSinPagos } from "./resumen";
import { millones, pesos, plural } from "./texto";

/**
 * Warning evaluator for the 10 rules of spec §5.
 *
 * Contract: an aviso is produced only when its condition truly holds today. Every rule
 * documents its exact boundary (strict vs inclusive) because the UI shows avisos "solo
 * cuando aplican": a false positive teaches the family to ignore the red. Each rule can be
 * switched off and, where it has one, its threshold tuned in Configuración.
 */

export type ReglaAvisoId =
  | "FIJO_VENCIDO"            // 1
  | "SOBRE_CERCA_TOPE"        // 2
  | "SOBRES_CIERRE_NEGATIVO"  // 3
  | "CUENTA_SIN_CONTAR"       // 4
  | "ARQUEO_NO_CUADRA"        // 5
  | "RETIRO_MAYOR_GANANCIA"   // 6
  | "CUENTA_SIN_SALDO"        // 7
  | "CREDITO_SIN_PAGOS"       // 8
  | "ANUAL_POR_VENCER"        // 9
  | "CIERRE_SIN_AHORRO";      // 10

export type NivelAviso = "ATENCION" | "PROBLEMA";
export type VistaAviso = "TABLERO" | "RESUMEN" | "CASA" | "NEGOCIO" | "AHORRO" | "ARQUEO" | "CREDITOS" | "ANOTAR";

export interface ReglaAviso {
  id: ReglaAvisoId;
  numero: number;
  nivel: NivelAviso;
  /** Default threshold; undefined for rules without one. */
  umbral?: number;
  /** Where the aviso is shown (Configuración "dónde" column). */
  vistas: VistaAviso[];
}

/** Catalogue in spec order. Levels are fixed by the spec; only `activa`/`umbral` are configurable. */
export const REGLAS_AVISO: readonly ReglaAviso[] = [
  { id: "FIJO_VENCIDO", numero: 1, nivel: "PROBLEMA", vistas: ["TABLERO", "CASA"] },
  { id: "SOBRE_CERCA_TOPE", numero: 2, nivel: "ATENCION", umbral: 90, vistas: ["CASA", "TABLERO"] },
  { id: "SOBRES_CIERRE_NEGATIVO", numero: 3, nivel: "ATENCION", vistas: ["TABLERO"] },
  { id: "CUENTA_SIN_CONTAR", numero: 4, nivel: "ATENCION", umbral: 7, vistas: ["ARQUEO", "TABLERO"] },
  { id: "ARQUEO_NO_CUADRA", numero: 5, nivel: "PROBLEMA", vistas: ["ARQUEO", "TABLERO"] },
  { id: "RETIRO_MAYOR_GANANCIA", numero: 6, nivel: "PROBLEMA", vistas: ["TABLERO", "RESUMEN"] },
  { id: "CUENTA_SIN_SALDO", numero: 7, nivel: "PROBLEMA", vistas: ["ANOTAR"] },
  { id: "CREDITO_SIN_PAGOS", numero: 8, nivel: "ATENCION", umbral: 90, vistas: ["TABLERO", "CREDITOS"] },
  { id: "ANUAL_POR_VENCER", numero: 9, nivel: "ATENCION", umbral: 30, vistas: ["TABLERO", "CASA"] },
  { id: "CIERRE_SIN_AHORRO", numero: 10, nivel: "ATENCION", vistas: ["AHORRO", "TABLERO"] },
];

export interface ConfigRegla {
  activa: boolean;
  umbral?: number;
}

/** Partial: a rule missing from the stored config falls back to active + default threshold. */
export type ConfigAvisos = Partial<Record<ReglaAvisoId, ConfigRegla>>;

export function configAvisosPorDefecto(): Record<ReglaAvisoId, ConfigRegla> {
  return Object.fromEntries(REGLAS_AVISO.map((r) => [r.id, { activa: true, umbral: r.umbral }])) as Record<ReglaAvisoId, ConfigRegla>;
}

export interface Aviso {
  reglaId: ReglaAvisoId;
  numero: number;
  nivel: NivelAviso;
  /** Short Spanish text shown next to the element. */
  texto: string;
  vistas: VistaAviso[];
  /** Element key the aviso attaches to: "fijo:<id>", "sobre:<id>", "ecuacion:casa", "cuenta:<id>", … */
  elemento: string;
  /** Ids behind an aggregated aviso (rule 8 lists the credits). */
  refs: string[];
  /** Named amounts for the UI ("pendiente", "falta", …), all integer pesos. */
  montos: Record<string, Pesos>;
}

/** Everything the rules look at. Fields are the engine's own outputs plus a few raw lists. */
export interface EstadoAvisosInput {
  mes: MesISO;
  hoy: DiaISO;
  /** Rule 1: from `calcularFijosDelMes`. */
  fijos: readonly FijoDelMes[];
  /** Rule 2: from `calcularSobresDelMes(...).sobres`. */
  sobres: readonly SobreDelMes[];
  /** Rule 3. */
  casa: CuentasCasa;
  /** Rules 4 and 5: active (non-archived) accounts only. */
  cuentas: readonly CuentaConteoInput[];
  /** Rule 6. */
  negocio: CuentasNegocio;
  /** Rule 7: movements being entered right now. Empty outside the Anotar panel. */
  salidasPropuestas?: readonly SalidaPropuestaInput[];
  /** Rule 8: active credits. */
  creditos: readonly CreditoCarteraInput[];
  /** Rule 9: every configured fijo and payments for upcoming occurrences. */
  gastosFijos: readonly GastoFijoInput[];
  pagosFijos: readonly PagoFijoInput[];
  /** Rule 10: the most recent month that already ended, if any. */
  cierreAnterior: CierreMesInput | null;
}

function resolverUmbral(regla: ReglaAviso, cfg: ConfigRegla | undefined): number {
  const u = cfg?.umbral ?? regla.umbral;
  if (u === undefined || !Number.isInteger(u) || u < 0) {
    throw new RangeError(`Umbral inválido para ${regla.id}: ${String(u)}`);
  }
  return u;
}

/**
 * Next occurrence (today or later) of an annual expense's due day. Uses this year's date if
 * it has not passed, otherwise next year's. Returns the day and the occurrence month.
 */
function proximaFechaAnual(f: GastoFijoInput, hoy: DiaISO): { dia: DiaISO; mes: MesISO } {
  const { anio } = partesDia(hoy);
  for (const a of [anio, anio + 1]) {
    const mes = `${a}-${String(f.mesAnual).padStart(2, "0")}`;
    const dia = diaEnMes(mes, f.diaPago);
    if (compararDias(dia, hoy) >= 0) return { dia, mes };
  }
  /* c8 ignore next */
  throw new Error("unreachable: next year's date is always ≥ today");
}

export function evaluarAvisos(estado: EstadoAvisosInput, config: ConfigAvisos = {}): Aviso[] {
  const out: Aviso[] = [];
  const { hoy, mes } = estado;

  for (const regla of REGLAS_AVISO) {
    const cfg = config[regla.id];
    if (cfg && !cfg.activa) continue;
    const add = (texto: string, elemento: string, montos: Record<string, Pesos> = {}, refs: string[] = []) =>
      out.push({ reglaId: regla.id, numero: regla.numero, nivel: regla.nivel, texto, vistas: [...regla.vistas], elemento, refs, montos });

    switch (regla.id) {
      // 1 · Due day strictly passed and money still owed (estado SIN_PAGAR already encodes both).
      case "FIJO_VENCIDO":
        for (const f of estado.fijos) {
          if (f.estado !== "SIN_PAGAR" || f.pendiente <= 0 || !f.vence) continue;
          add(`${f.nombre} sin pagar desde el ${diaDelMes(f.vence)} · ${pesos(f.pendiente)}`, `fijo:${f.id}`, { pendiente: f.pendiente }, [f.id]);
        }
        break;

      // 2 · gastado ≥ N % of the cap, integer comparison. Over-the-cap envelopes also fire
      //     (they reached N % on the way). A 0 cap never fires: there is no share to reach.
      case "SOBRE_CERCA_TOPE": {
        const n = resolverUmbral(regla, cfg);
        for (const s of estado.sobres) {
          if (s.tope <= 0 || s.gastado * 100 < n * s.tope) continue;
          const pasado = s.gastado > s.tope;
          add(
            pasado ? `${s.nombre} pasó el tope por ${pesos(s.gastado - s.tope)}` : `${s.nombre} va en el ${Math.floor((s.gastado * 100) / s.tope)} % del tope`,
            `sobre:${s.id}`, { gastado: s.gastado, tope: s.tope, queda: s.queda }, [s.id],
          );
        }
        break;
      }

      // 3 · Strictly negative (closing at exactly 0 is not "en negativo"), and only while the
      //     month is still open: once it ended, the envelopes can no longer be spent.
      case "SOBRES_CIERRE_NEGATIVO":
        if (compararDias(hoy, ultimoDia(mes)) <= 0 && estado.casa.siSeGastanSobres < 0) {
          add(
            `Si se gasta lo que queda en los sobres, ${nombreMes(mes)} cierra en ${pesos(estado.casa.siSeGastanSobres)}.`,
            "ecuacion:casa", { siSeGastanSobres: estado.casa.siSeGastanSobres, quedaEnSobres: estado.casa.quedaEnSobres, alCierre: estado.casa.alCierre },
          );
        }
        break;

      // 4 · "más de N días": strictly greater. Never-counted accounts count from `desde`.
      case "CUENTA_SIN_CONTAR": {
        const n = resolverUmbral(regla, cfg);
        for (const c of estado.cuentas) {
          const dias = diferenciaDias(c.ultimoArqueo?.fecha ?? c.desde, hoy);
          if (dias > n) add(`${c.nombre} sin contar hace ${dias} días`, `cuenta:${c.cuentaId}`, {}, [c.cuentaId]);
        }
        break;
      }

      // 5 · Only the latest arqueo matters: a later one that balanced clears the problem.
      case "ARQUEO_NO_CUADRA":
        for (const c of estado.cuentas) {
          const d = c.ultimoArqueo?.diferencia;
          if (d === undefined || d === 0) continue;
          add(`${c.nombre}: ${d < 0 ? "faltan" : "sobran"} ${pesos(Math.abs(d))}`, `cuenta:${c.cuentaId}`, { diferencia: d }, [c.cuentaId]);
        }
        break;

      // 6 · Strictly more taken than earned, and something was actually taken: a loss month
      //     with no retiros shrinks capital too, but that is not this rule's story.
      case "RETIRO_MAYOR_GANANCIA": {
        const { retirosCasa, ganancia } = estado.negocio;
        if (retirosCasa > 0 && retirosCasa > ganancia) {
          add(
            `En ${nombreMes(mes)} se llevó a la casa ${pesos(retirosCasa - ganancia)} más de lo que ganó el negocio`,
            "ecuacion:negocio", { exceso: retirosCasa - ganancia, retirosCasa, ganancia },
          );
        }
        break;
      }

      // 7 · Leaving the account below zero. Emptying it exactly to 0 is allowed.
      case "CUENTA_SIN_SALDO":
        for (const s of estado.salidasPropuestas ?? []) {
          const queda = s.saldoActual - s.monto;
          if (queda < 0) {
            add(`${s.nombreCuenta} quedaría en ${pesos(queda)}`, `cuenta:${s.cuentaId}`, { saldoActual: s.saldoActual, monto: s.monto, quedaria: queda }, [s.cuentaId]);
          }
        }
        break;

      // 8 · Strictly more than N days without payments; one aggregated aviso for "En la calle"
      //     (the canvas shows "3 créditos sin pagos hace más de 90 días · $ 8,4 M").
      case "CREDITO_SIN_PAGOS": {
        const n = resolverUmbral(regla, cfg);
        const lentos = estado.creditos.filter((c) => c.saldoCapital > 0 && diasSinPagos(c, hoy) > n);
        if (lentos.length > 0) {
          const saldo = sumarPesos(lentos.map((c) => c.saldoCapital));
          add(`${plural(lentos.length, "crédito")} sin pagos hace más de ${n} días · $ ${millones(saldo)}`, "en-la-calle", { saldo }, lentos.map((c) => c.creditoId));
        }
        break;
      }

      // 9 · Next unpaid occurrence due in [0, N) days: "menos de N días", today included.
      //     Overdue annual ones are rule 1's job, so only today-or-later dates are looked at.
      case "ANUAL_POR_VENCER": {
        const n = resolverUmbral(regla, cfg);
        for (const f of estado.gastosFijos) {
          if (f.periodicidad !== "ANUAL" || f.monto <= 0) continue;
          const prox = proximaFechaAnual(f, hoy);
          const dias = diferenciaDias(hoy, prox.dia);
          if (dias >= n) continue;
          const pagado = sumarPesos(estado.pagosFijos.filter((p) => p.gastoId === f.id && (p.mes ?? mesDe(p.fecha)) === prox.mes).map((p) => p.monto));
          if (pagado >= f.monto) continue;
          const pendiente = f.monto - pagado;
          const { mes: m, dia: d } = partesDia(prox.dia);
          add(`${f.nombre} vence el ${d} de ${nombreMes(aDia(2000, m, 1).slice(0, 7))} · ${pesos(pendiente)}`, `fijo:${f.id}`, { pendiente }, [f.id]);
        }
        break;
      }

      // 10 · The month is over (today after its last day), something was left over, and less
      //      than that reached savings.
      case "CIERRE_SIN_AHORRO": {
        const c = estado.cierreAnterior;
        if (!c || compararDias(hoy, ultimoDia(c.mes)) <= 0) break;
        const falta = c.sobrante - c.pasadoAlAhorro;
        if (c.sobrante > 0 && falta > 0) {
          add(`Sobraron ${pesos(c.sobrante)} de ${nombreMes(c.mes)} y faltan ${pesos(falta)} por pasar al ahorro`, `cierre:${c.mes}`, { sobrante: c.sobrante, pasadoAlAhorro: c.pasadoAlAhorro, falta });
        }
        break;
      }
    }
  }
  return out;
}
