/**
 * View model of the Casa tab (`Casa.dc.html`), built from the month read
 * (`CasaNegocioMes`, see `queries.ts`) and the pure domain engine.
 *
 * PURE MODULE: no Prisma, no NextAuth, no React. The page calls
 * `obtenerCasaNegocioMes` (which authorizes) and hands the result here, so the
 * whole tab is unit-tested from plain objects. Everything returned is plain
 * data, safe to pass to client components.
 *
 * It also exports `motorDelMes`, the single mapping from the read contract to
 * the engine's inputs (integer pesos, day keys) that Casa and Negocio share,
 * so both tabs and their avisos agree on every total.
 */
import {
  calcularMes,
  evaluarAvisos,
  type Aviso,
  type ConfigAvisos,
  type GastoFijoInput,
  type MesCalculado,
  type ReglaAvisoId,
} from "@/features/casa-negocio/domain";
import { diasDelMes, parseMes, sumarMeses } from "@/features/casa-negocio/mes";
import type {
  CasaNegocioMes,
  CodigoAviso,
  CuentaMes,
  MovimientoManual,
  TipoMovimiento,
} from "@/features/casa-negocio/types";

// ---------------------------------------------------------------------------
// Shared: read contract -> engine
// ---------------------------------------------------------------------------

/** Stored alert codes (Configuración) -> engine rule ids. */
export const REGLA_DE_CODIGO: Record<CodigoAviso, ReglaAvisoId> = {
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

/** Alert configuration as the engine reads it. Rules absent from the table keep their defaults. */
export function configAvisosDe(datos: Pick<CasaNegocioMes, "configuracion">): ConfigAvisos {
  const config: ConfigAvisos = {};
  for (const regla of datos.configuracion.reglas) {
    config[REGLA_DE_CODIGO[regla.codigo]] = { activa: regla.activa, umbral: regla.umbral ?? undefined };
  }
  return config;
}

/** The engine works in whole pesos; the read may carry cents. */
const p = (n: number) => Math.round(n);
const suma = (values: number[]) => values.reduce((a, b) => a + p(b), 0);

function deTipo(movs: readonly MovimientoManual[], tipo: TipoMovimiento) {
  return movs.filter((m) => m.tipo === tipo);
}

export interface MotorDelMes {
  calculado: MesCalculado;
  avisos: Aviso[];
  config: ConfigAvisos;
}

/**
 * Feeds the engine with the month: every total of the equations, the fijos
 * and sobres, and the avisos of spec §5 that can be judged from one month.
 * Rules that need other months or the portfolio (8, 10) get empty inputs and
 * therefore stay silent here; the Tablero owns them.
 */
export function motorDelMes(datos: CasaNegocioMes): MotorDelMes {
  const movs = datos.movimientos;
  const config = configAvisosDe(datos);
  const umbralSobre = config.SOBRE_CERCA_TOPE?.umbral ?? 90;

  // A fixed expense without a pay day is due on the month's last day: it
  // never shows as overdue before the month is over.
  const gastosFijos: GastoFijoInput[] = datos.categorias
    .filter((c) => c.clase === "FIJO" && c.activa && (c.periodicidad === "MENSUAL" || c.mesAnual !== null))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      monto: p(c.monto ?? 0),
      periodicidad: c.periodicidad,
      mesAnual: c.mesAnual ?? undefined,
      diaPago: c.diaPago ?? 31,
    }));
  const pagosFijos = deTipo(movs, "GASTO_FIJO")
    .filter((m) => m.categoriaId)
    .map((m) => ({ gastoId: m.categoriaId!, fecha: m.fecha, monto: p(m.monto) }));
  const sobres = datos.categorias
    .filter((c) => c.clase === "VARIABLE" && c.activa && c.monto !== null)
    .map((c) => ({ id: c.id, nombre: c.nombre, tope: p(c.monto!) }));
  const gastosVariables = deTipo(movs, "GASTO_VARIABLE").map((m) => ({
    sobreId: m.categoriaId,
    fecha: m.fecha,
    monto: p(m.monto),
  }));
  const retirosCasa = suma(deTipo(movs, "RETIRO_CASA").map((m) => m.monto));
  const nombreCuenta = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));

  const calculado = calcularMes({
    mes: datos.mes,
    hoy: datos.hoy,
    negocio: {
      interesesCobrados: suma(datos.cobros.map((c) => c.interes)),
      capitalCobrado: suma(datos.cobros.map((c) => c.capital)),
      gastos: suma(deTipo(movs, "GASTO_NEGOCIO").map((m) => m.monto)),
      perdidos: suma(datos.castigos.filter((c) => c.fecha.startsWith(datos.mes)).map((c) => c.monto)),
      retirosCasa,
      desembolsos: suma(datos.desembolsos.map((d) => d.monto)),
      aportes: suma(deTipo(movs, "APORTE").map((m) => m.monto)),
    },
    casaIngresos: { retirosRecibidos: retirosCasa, ingresosExtra: suma(deTipo(movs, "INGRESO_CASA").map((m) => m.monto)) },
    gastosFijos,
    pagosFijos,
    sobres,
    gastosVariables,
    cobrosHechos: datos.cobros.map((c) => ({ creditoId: c.creditoId, fecha: c.fechaPago, monto: p(c.total) })),
    cuotas: datos.cuotasPorCobrar.map((c) => ({ creditoId: c.creditoId, fechaProgramada: c.fechaProgramada, pendiente: p(c.pendiente) })),
    retiros: deTipo(movs, "RETIRO_CASA").map((m) => ({
      id: m.id,
      fecha: m.fecha,
      monto: p(m.monto),
      cuentaOrigen: nombreCuenta.get(m.cuentaOrigenId ?? "") ?? "",
      cuentaDestino: nombreCuenta.get(m.cuentaDestinoId ?? "") ?? "",
    })),
    umbralSobre,
  });

  const avisos = evaluarAvisos(
    {
      mes: datos.mes,
      hoy: datos.hoy,
      fijos: calculado.fijos,
      sobres: calculado.sobres.sobres,
      casa: calculado.casa,
      cuentas: datos.cuentas.filter((c) => !c.archivada).map((c) => cuentaConteo(datos, c)),
      negocio: calculado.negocio,
      creditos: [],
      gastosFijos,
      pagosFijos,
      cierreAnterior: null,
    },
    config,
  );
  return { calculado, avisos, config };
}

/** Counting history of an account for rules 4 and 5, from the recent arqueos. */
function cuentaConteo(datos: CasaNegocioMes, cuenta: CuentaMes) {
  // `arqueos` comes most recent first.
  for (const arqueo of datos.arqueos) {
    const detalle = arqueo.detalles.find((d) => d.cuentaId === cuenta.id);
    if (detalle) {
      return {
        cuentaId: cuenta.id,
        nombre: cuenta.nombre,
        desde: cuenta.fechaSaldoInicial,
        ultimoArqueo: { fecha: diaBogotaDeInstante(arqueo.fecha), diferencia: p(detalle.diferencia) },
      };
    }
  }
  return { cuentaId: cuenta.id, nombre: cuenta.nombre, desde: cuenta.fechaSaldoInicial, ultimoArqueo: null };
}

/** `YYYY-MM-DD` in Bogota (fixed UTC-5) of an ISO instant. */
export function diaBogotaDeInstante(instante: string): string {
  return new Date(new Date(instante).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** Notice shown beside an element: the engine's aviso, reduced to what the UI draws. */
export interface AvisoVista {
  nivel: "atencion" | "problema";
  texto: string;
}

export function avisoVista(aviso: Aviso): AvisoVista {
  return { nivel: aviso.nivel === "PROBLEMA" ? "problema" : "atencion", texto: aviso.texto };
}

/** Avisos of one view, keyed by the element they attach to («fijo:<id>», «sobre:<id>»…). */
export function avisosPorElemento(avisos: readonly Aviso[], vista: Aviso["vistas"][number]): Map<string, AvisoVista[]> {
  const out = new Map<string, AvisoVista[]>();
  for (const aviso of avisos) {
    if (!aviso.vistas.includes(vista)) continue;
    const lista = out.get(aviso.elemento) ?? [];
    lista.push(avisoVista(aviso));
    out.set(aviso.elemento, lista);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared: form helpers
// ---------------------------------------------------------------------------

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export function nombreDelMes(mes: string): string {
  const partes = parseMes(mes);
  return partes ? MESES[partes.mes - 1] : mes;
}

/** Short weekday of a `YYYY-MM-DD` day («lun»). */
export function diaSemana(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/**
 * Day the «Anotar» forms start on: today when looking at the current month
 * (or a future one: nothing can be dated after today), the month's last day
 * for a past month, so a late entry lands in the month being looked at.
 */
export function fechaPorDefecto(mes: string, hoy: string): string {
  if (hoy.slice(0, 7) <= mes) return hoy;
  const partes = parseMes(mes)!;
  return `${mes}-${String(diasDelMes(partes.anio, partes.mes)).padStart(2, "0")}`;
}

/** An account as the forms offer it: name and balance for alert 7. */
export interface CuentaOpcion {
  id: string;
  nombre: string;
  saldoActual: number;
  /** First day a movement may be dated in it. */
  desde: string;
}

export function cuentasDeGrupo(datos: CasaNegocioMes, grupo: CuentaMes["grupo"]): CuentaOpcion[] {
  return datos.cuentas
    .filter((c) => c.grupo === grupo && !c.archivada)
    .map((c) => ({ id: c.id, nombre: c.nombre, saldoActual: c.saldoActual, desde: c.fechaSaldoInicial }));
}

/** What an edit form needs to show a stored movement and send it back under the lock. */
export interface MovimientoEditable {
  id: string;
  version: string;
  tipo: TipoMovimiento;
  fecha: string;
  monto: number;
  cuentaOrigenId: string | null;
  cuentaDestinoId: string | null;
  categoriaId: string | null;
  nota: string | null;
}

export function editableDe(m: MovimientoManual): MovimientoEditable {
  return {
    id: m.id,
    version: m.version,
    tipo: m.tipo,
    fecha: m.fecha,
    monto: m.monto,
    cuentaOrigenId: m.cuentaOrigenId,
    cuentaDestinoId: m.cuentaDestinoId,
    categoriaId: m.categoriaId,
    nota: m.nota,
  };
}

/** Month navigation kept in the query, same convention as the header (`?mes=AAAA-MM`). */
export function mesesVecinos(mes: string, hoy: string): { anterior: string; siguiente: string | null } {
  const siguiente = sumarMeses(mes, 1);
  return { anterior: sumarMeses(mes, -1), siguiente: siguiente <= hoy.slice(0, 7) ? siguiente : null };
}

// ---------------------------------------------------------------------------
// Casa
// ---------------------------------------------------------------------------

export type ClaseFilaCasa = "fijo" | "variable" | "ingreso" | "retiro" | "otro";

export interface FilaCasa {
  id: string;
  clase: ClaseFilaCasa;
  nombre: string;
  detalle: string;
  /** Signed: money in is positive, money out negative, transfers inside the house 0. */
  monto: number;
  /** Amount shown for transfers inside the house (monto is 0 for them). */
  montoTraslado: number | null;
  /** Null for movements edited elsewhere (retiros and aportes live in Negocio). */
  editable: MovimientoEditable | null;
}

export interface DiaCasa {
  fecha: string;
  dia: number;
  semana: string;
  filas: FilaCasa[];
}

export type EstadoFijoVista = "pagado" | "vencido" | "porVenir" | "noToca";

export interface FijoVista {
  id: string;
  nombre: string;
  estado: EstadoFijoVista;
  detalle: string;
  monto: number;
  pendiente: number;
  avisos: AvisoVista[];
}

export interface SobreVista {
  id: string;
  nombre: string;
  gastado: number;
  tope: number;
  queda: number;
  nivel: "NORMAL" | "CERCA" | "PASADO";
  /** Fill of the bar, 0-100. */
  ancho: number;
  avisos: AvisoVista[];
}

/** A fixed expense still owed this month: a chip that pre-fills the form. */
export interface PendienteFijo {
  categoriaId: string;
  nombre: string;
  pendiente: number;
  vencido: boolean;
}

export interface OpcionCategoria {
  id: string;
  nombre: string;
  /** Text of the option («Mercado · quedan $ 1.490.000»). */
  etiqueta: string;
  /** Fijos: configured amount, to pre-fill. */
  monto: number | null;
}

export interface VistaCasa {
  mes: string;
  hoy: string;
  nombreMes: string;
  puedeAnotar: boolean;
  /** No active household account: the form cannot be used. */
  sinCuentas: boolean;
  puedeConfigurar: boolean;
  ecuacion: { entro: number; fijos: number; variables: number; hoy: number };
  formulario: {
    cuentas: CuentaOpcion[];
    fijos: OpcionCategoria[];
    sobres: OpcionCategoria[];
    pendientes: PendienteFijo[];
    fechaPorDefecto: string;
    /** Alert 7 is on in Configuración. */
    avisoSinSaldo: boolean;
  };
  libro: DiaCasa[];
  fijos: FijoVista[];
  sobres: SobreVista[];
}

const fmt = (n: number) => `$ ${Math.round(Math.abs(n)).toLocaleString("es-CO")}`;

function diaDe(fecha: string | null): string {
  return fecha ? String(Number(fecha.slice(8, 10))) : "";
}

export function construirVistaCasa(datos: CasaNegocioMes): VistaCasa {
  const { calculado, avisos, config } = motorDelMes(datos);
  const porElemento = avisosPorElemento(avisos, "CASA");
  const cuentasCasa = new Set(datos.cuentas.filter((c) => c.grupo === "CASA").map((c) => c.id));
  const nombreCuenta = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const categoria = new Map(datos.categorias.map((c) => [c.id, c]));
  const cuenta = (id: string | null) => (id ? (nombreCuenta.get(id) ?? "") : "");

  // --- Book: movements that touch a household account, newest day first.
  const filas: { fecha: string; creadoEn: string; fila: FilaCasa }[] = [];
  for (const m of datos.movimientos) {
    const sale = m.cuentaOrigenId !== null && cuentasCasa.has(m.cuentaOrigenId);
    const entra = m.cuentaDestinoId !== null && cuentasCasa.has(m.cuentaDestinoId);
    if (!sale && !entra) continue;
    let fila: FilaCasa;
    switch (m.tipo) {
      case "GASTO_FIJO":
      case "GASTO_VARIABLE":
        fila = {
          id: m.id,
          clase: m.tipo === "GASTO_FIJO" ? "fijo" : "variable",
          nombre: categoria.get(m.categoriaId ?? "")?.nombre ?? "Gasto de la casa",
          detalle: m.nota ?? cuenta(m.cuentaOrigenId),
          monto: -m.monto,
          montoTraslado: null,
          editable: editableDe(m),
        };
        break;
      case "INGRESO_CASA":
        fila = {
          id: m.id,
          clase: "ingreso",
          nombre: m.nota ?? "Ingreso",
          detalle: cuenta(m.cuentaDestinoId),
          monto: m.monto,
          montoTraslado: null,
          editable: editableDe(m),
        };
        break;
      case "RETIRO_CASA":
        // «Los retiros del negocio aparecen solos»: recorded in Negocio, read here.
        fila = {
          id: m.id,
          clase: "retiro",
          nombre: "Retiro del negocio",
          detalle: `${cuenta(m.cuentaOrigenId)} → ${cuenta(m.cuentaDestinoId)}`,
          monto: m.monto,
          montoTraslado: null,
          editable: null,
        };
        break;
      case "APORTE":
        fila = {
          id: m.id,
          clase: "otro",
          nombre: "Aporte al negocio",
          detalle: `${cuenta(m.cuentaOrigenId)} → ${cuenta(m.cuentaDestinoId)}`,
          monto: -m.monto,
          montoTraslado: null,
          editable: null,
        };
        break;
      default:
        // TRASLADO between household accounts (pasar al ahorro, …).
        fila = {
          id: m.id,
          clase: "otro",
          nombre: datos.configuracion.cuentaAhorroId === m.cuentaDestinoId ? "Al ahorro" : "Traslado",
          detalle: `${cuenta(m.cuentaOrigenId)} → ${cuenta(m.cuentaDestinoId)}`,
          monto: 0,
          montoTraslado: m.monto,
          editable: null,
        };
    }
    filas.push({ fecha: m.fecha, creadoEn: m.creadoEn, fila });
  }
  filas.sort((a, b) => (a.fecha === b.fecha ? b.creadoEn.localeCompare(a.creadoEn) : b.fecha.localeCompare(a.fecha)));
  const libro: DiaCasa[] = [];
  for (const { fecha, fila } of filas) {
    let dia = libro[libro.length - 1];
    if (!dia || dia.fecha !== fecha) {
      dia = { fecha, dia: Number(fecha.slice(8, 10)), semana: diaSemana(fecha), filas: [] };
      libro.push(dia);
    }
    dia.filas.push(fila);
  }

  // --- Fijos of the month: paid, overdue, still to come, then not this month.
  const ordenEstado: Record<EstadoFijoVista, number> = { pagado: 0, vencido: 1, porVenir: 2, noToca: 3 };
  const fijos: FijoVista[] = calculado.fijos
    .map((f): FijoVista => {
      const estado: EstadoFijoVista =
        f.estado === "PAGADO" ? "pagado" : f.estado === "SIN_PAGAR" ? "vencido" : f.estado === "NO_TOCA" ? "noToca" : "porVenir";
      const detalle =
        estado === "pagado"
          ? `Pagado el ${diaDe(f.pagadoEl)}`
          : estado === "vencido"
            ? `Venció el ${diaDe(f.vence)}`
            : estado === "noToca"
              ? `En ${f.mesQueToca ?? "otro mes"}`
              : f.pagado > 0
                ? `Faltan ${fmt(f.pendiente)} · vence el ${diaDe(f.vence)}`
                : `Vence el ${diaDe(f.vence)}`;
      return { id: f.id, nombre: f.nombre, estado, detalle, monto: f.monto, pendiente: f.pendiente, avisos: porElemento.get(`fijo:${f.id}`) ?? [] };
    })
    .sort((a, b) => ordenEstado[a.estado] - ordenEstado[b.estado]);

  const sobres: SobreVista[] = calculado.sobres.sobres.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    gastado: s.gastado,
    tope: s.tope,
    queda: s.queda,
    nivel: s.nivel,
    ancho: s.tope > 0 ? Math.min(100, Math.round((s.gastado * 100) / s.tope)) : s.gastado > 0 ? 100 : 0,
    avisos: porElemento.get(`sobre:${s.id}`) ?? [],
  }));

  // --- Form options.
  const pendientes: PendienteFijo[] = calculado.fijos
    .filter((f) => f.pendiente > 0 && (f.estado === "SIN_PAGAR" || f.estado === "POR_VENIR"))
    .sort((a, b) => (a.vence ?? "").localeCompare(b.vence ?? ""))
    .map((f) => ({ categoriaId: f.id, nombre: f.nombre, pendiente: f.pendiente, vencido: f.estado === "SIN_PAGAR" }));
  const opcionesFijos: OpcionCategoria[] = datos.categorias
    .filter((c) => c.clase === "FIJO" && c.activa)
    .map((c) => ({ id: c.id, nombre: c.nombre, etiqueta: c.nombre, monto: c.monto }));
  const sobrePorId = new Map(sobres.map((s) => [s.id, s]));
  const opcionesSobres: OpcionCategoria[] = datos.categorias
    .filter((c) => c.clase === "VARIABLE" && c.activa)
    .map((c) => {
      const s = sobrePorId.get(c.id);
      const etiqueta = !s
        ? c.nombre
        : s.queda < 0
          ? `${c.nombre} · pasado del tope`
          : `${c.nombre} · quedan ${fmt(s.queda)}`;
      return { id: c.id, nombre: c.nombre, etiqueta, monto: null };
    });
  const cuentas = cuentasDeGrupo(datos, "CASA");

  return {
    mes: datos.mes,
    hoy: datos.hoy,
    nombreMes: nombreDelMes(datos.mes),
    puedeAnotar: datos.usuario.capacidades.includes("ANOTAR"),
    sinCuentas: cuentas.length === 0,
    puedeConfigurar: datos.usuario.capacidades.includes("CONFIGURAR"),
    ecuacion: {
      entro: calculado.casa.entro,
      fijos: calculado.casa.fijos,
      variables: calculado.casa.variables,
      hoy: calculado.casa.hoy,
    },
    formulario: {
      cuentas,
      fijos: opcionesFijos,
      sobres: opcionesSobres,
      pendientes,
      fechaPorDefecto: fechaPorDefecto(datos.mes, datos.hoy),
      avisoSinSaldo: config.CUENTA_SIN_SALDO?.activa ?? true,
    },
    libro,
    fijos,
    sobres,
  };
}
