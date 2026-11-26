/**
 * View model of the Negocio tab (`Negocio.dc.html`): the business equation,
 * the accounts as filters, the «Anotar en el negocio» options, the cash book
 * with its running balance (automatic «L» rows from Créditos mixed with the
 * manual ones) and the cobros/desembolsos still without account.
 *
 * PURE MODULE, like `vista-casa.ts`: plain data in, plain data out.
 *
 * RUNNING BALANCE. It is walked BACKWARDS from each account's balance at the
 * end of the month (`saldoFinMes`, module-wide, see `saldos.ts`), so the
 * newest row always agrees with the account card above the book even when
 * the viewer cannot see some loans of another owner. Rows still «sin cuenta»
 * move no balance: they are shown with the picker instead.
 */
import type { CasaNegocioMes, CobroMes, DesembolsoMes, MovimientoManual } from "@/features/casa-negocio/types";

import {
  cuentasDeGrupo,
  diaBogotaDeInstante,
  editableDe,
  fechaPorDefecto,
  motorDelMes,
  nombreDelMes,
  type CuentaOpcion,
  type MovimientoEditable,
} from "./vista-casa";

/** Key of the «Todo el negocio» filter. */
export const TODAS = "todas";

export interface FiltroCuenta {
  id: string;
  nombre: string;
  saldo: number;
  detalle: string;
  tono: "neutral" | "ok" | "atencion" | "problema";
}

/** What the inline picker sends to `asignarCuenta`. */
export interface Asignacion {
  clase: "cobro" | "desembolso";
  eventoFinancieroId: string | null;
  creditoId: string | null;
  /** Version of an existing assignment (null for the first one). */
  version: string | null;
  /** «¿Dónde entró?» / «¿De dónde salió?». */
  pregunta: string;
}

export interface FilaNegocio {
  key: string;
  fecha: string;
  dia: number;
  origen: "auto" | "manual";
  tipo: string;
  detalle: string;
  /** Owner of the loan when it is not the viewer's («de María»). */
  dueno: string | null;
  cuentaTexto: string;
  /** Business accounts this row moves; empty while «sin cuenta». */
  cuentas: string[];
  capital: number | null;
  interes: number | null;
  /** Effect on the whole business: + in, − out, 0 for a transfer between business accounts. */
  efecto: number;
  /** Amount shown when `efecto` is 0 (transfers). */
  montoNeutral: number | null;
  /** Effect per business account touched. */
  efectoPorCuenta: Record<string, number>;
  /** Balance of the whole business after the row; null while «sin cuenta». */
  saldo: number | null;
  /** Balance of each touched account after the row. */
  saldoPorCuenta: Record<string, number>;
  /** Present while the row has no account and can get one. */
  asignacion: Asignacion | null;
  editable: MovimientoEditable | null;
}

export interface PendienteAsignar {
  key: string;
  fecha: string;
  tipo: string;
  detalle: string;
  dueno: string | null;
  monto: number;
  /** Positive for cobros (money in), negative for disbursements. */
  signo: 1 | -1;
  asignacion: Asignacion;
}

export interface VistaNegocio {
  mes: string;
  hoy: string;
  nombreMes: string;
  puedeAnotar: boolean;
  puedeConfigurar: boolean;
  sinCuentas: boolean;
  ecuacion: { intereses: number; gastos: number; perdidos: number; ganancia: number; aCasa: number; reinvertido: number };
  filtros: FiltroCuenta[];
  formulario: {
    cuentasNegocio: CuentaOpcion[];
    cuentasCasa: CuentaOpcion[];
    fechaPorDefecto: string;
    avisoSinSaldo: boolean;
  };
  libro: FilaNegocio[];
  /** Cobros and disbursements of ANY month still without account, oldest first. */
  sinCuenta: PendienteAsignar[];
}

const fmt = (n: number) => `$ ${Math.round(Math.abs(n)).toLocaleString("es-CO")}`;

function dueno(row: CobroMes | DesembolsoMes): string | null {
  if (row.esPropio) return null;
  return row.dueno ? `de ${row.dueno.nombre}` : "sin dueño";
}

function tipoCobro(c: CobroMes): string {
  return c.tipo === "ABONO" ? "Abono a capital" : c.numeroCuota ? `Cuota ${c.numeroCuota}` : "Cuota";
}

function asignacionCobro(c: CobroMes): Asignacion {
  return { clase: "cobro", eventoFinancieroId: c.eventoFinancieroId, creditoId: null, version: c.asignacionVersion, pregunta: "¿Dónde entró?" };
}

function asignacionDesembolso(d: DesembolsoMes): Asignacion {
  return { clase: "desembolso", eventoFinancieroId: null, creditoId: d.creditoId, version: d.asignacionVersion, pregunta: "¿De dónde salió?" };
}

interface FilaBase extends Omit<FilaNegocio, "saldo" | "saldoPorCuenta"> {
  /** Sort key inside a day: manual rows by creation, automatic ones after them. */
  orden: string;
}

export function construirVistaNegocio(datos: CasaNegocioMes): VistaNegocio {
  const { calculado, avisos, config } = motorDelMes(datos);
  const negocio = datos.cuentas.filter((c) => c.grupo === "NEGOCIO");
  const idsNegocio = new Set(negocio.map((c) => c.id));
  const nombreCuenta = new Map(datos.cuentas.map((c) => [c.id, c.nombre]));
  const nombre = (id: string | null) => (id ? (nombreCuenta.get(id) ?? "") : "");

  // --- Rows (chronological; reversed at the end).
  const base: FilaBase[] = [];
  for (const c of datos.cobros) {
    const asignada = c.cuentaId !== null && idsNegocio.has(c.cuentaId);
    base.push({
      key: `cobro:${c.eventoFinancieroId}`,
      fecha: c.fechaPago,
      dia: Number(c.fechaPago.slice(8, 10)),
      origen: "auto",
      tipo: tipoCobro(c),
      detalle: `${c.creditoCodigo} · ${c.clienteNombre}`,
      dueno: dueno(c),
      cuentaTexto: asignada ? nombre(c.cuentaId) : "Sin cuenta",
      cuentas: asignada ? [c.cuentaId!] : [],
      capital: c.capital || null,
      interes: c.interes || null,
      efecto: c.total,
      montoNeutral: null,
      efectoPorCuenta: asignada ? { [c.cuentaId!]: c.total } : {},
      asignacion: c.asignable && !asignada ? asignacionCobro(c) : null,
      editable: null,
      orden: `2:${c.eventoFinancieroId}`,
    });
  }
  for (const d of datos.desembolsos) {
    const asignada = d.cuentaId !== null && idsNegocio.has(d.cuentaId);
    base.push({
      key: `desembolso:${d.creditoId}`,
      fecha: d.fecha,
      dia: Number(d.fecha.slice(8, 10)),
      origen: "auto",
      tipo: "Préstamo entregado",
      detalle: `${d.creditoCodigo} · ${d.clienteNombre}`,
      dueno: dueno(d),
      cuentaTexto: asignada ? nombre(d.cuentaId) : "Sin cuenta",
      cuentas: asignada ? [d.cuentaId!] : [],
      capital: d.monto,
      interes: null,
      efecto: -d.monto,
      montoNeutral: null,
      efectoPorCuenta: asignada ? { [d.cuentaId!]: -d.monto } : {},
      asignacion: d.asignable && !asignada ? asignacionDesembolso(d) : null,
      editable: null,
      orden: `3:${d.creditoId}`,
    });
  }
  for (const m of datos.movimientos) {
    const fila = filaManual(m, idsNegocio, nombre);
    if (fila) base.push(fila);
  }
  base.sort((a, b) => (a.fecha === b.fecha ? a.orden.localeCompare(b.orden) : a.fecha.localeCompare(b.fecha)));

  // --- Running balance, walked backwards from the end of the month.
  const saldoCuenta = new Map(negocio.map((c) => [c.id, c.saldoFinMes]));
  let saldoTotal = negocio.reduce((a, c) => a + c.saldoFinMes, 0);
  const libro: FilaNegocio[] = [];
  for (let i = base.length - 1; i >= 0; i--) {
    const { orden: _orden, ...fila } = base[i];
    void _orden;
    const sinCuenta = fila.cuentas.length === 0;
    const saldoPorCuenta: Record<string, number> = {};
    for (const id of fila.cuentas) saldoPorCuenta[id] = saldoCuenta.get(id) ?? 0;
    libro.push({ ...fila, saldo: sinCuenta ? null : saldoTotal, saldoPorCuenta });
    for (const [id, efecto] of Object.entries(fila.efectoPorCuenta)) {
      saldoCuenta.set(id, (saldoCuenta.get(id) ?? 0) - efecto);
      saldoTotal -= efecto;
    }
  }

  // --- Account filters with their counting status.
  const activas = negocio.filter((c) => !c.archivada);
  const filtros: FiltroCuenta[] = [
    {
      id: TODAS,
      nombre: "Todo el negocio",
      saldo: activas.reduce((a, c) => a + c.saldoActual, 0),
      detalle: activas.length === 1 ? "1 cuenta" : `${activas.length} cuentas`,
      tono: "neutral",
    },
    ...activas.map((c): FiltroCuenta => {
      const estado = estadoConteo(datos, c.id);
      const aviso = avisos.find((a) => a.reglaId === "CUENTA_SIN_CONTAR" && a.elemento === `cuenta:${c.id}`);
      // A count that did not match outranks «sin contar»: it is the problem level.
      if (aviso && estado.tono !== "problema") {
        return { id: c.id, nombre: c.nombre, saldo: c.saldoActual, detalle: aviso.texto.replace(`${c.nombre} sin`, "Sin"), tono: "atencion" };
      }
      return { id: c.id, nombre: c.nombre, saldo: c.saldoActual, ...estado };
    }),
  ];

  // --- Pending assignments of any month.
  const sinCuenta: PendienteAsignar[] = [
    ...datos.sinCuenta.cobros.map((c): PendienteAsignar => ({
      key: `cobro:${c.eventoFinancieroId}`,
      fecha: c.fechaPago,
      tipo: tipoCobro(c),
      detalle: `${c.creditoCodigo} · ${c.clienteNombre}`,
      dueno: dueno(c),
      monto: c.total,
      signo: 1,
      asignacion: asignacionCobro(c),
    })),
    ...datos.sinCuenta.desembolsos.map((d): PendienteAsignar => ({
      key: `desembolso:${d.creditoId}`,
      fecha: d.fecha,
      tipo: "Préstamo entregado",
      detalle: `${d.creditoCodigo} · ${d.clienteNombre}`,
      dueno: dueno(d),
      monto: d.monto,
      signo: -1,
      asignacion: asignacionDesembolso(d),
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const cuentasNegocio = cuentasDeGrupo(datos, "NEGOCIO");
  const n = calculado.negocio;
  return {
    mes: datos.mes,
    hoy: datos.hoy,
    nombreMes: nombreDelMes(datos.mes),
    puedeAnotar: datos.usuario.capacidades.includes("ANOTAR"),
    puedeConfigurar: datos.usuario.capacidades.includes("CONFIGURAR"),
    sinCuentas: cuentasNegocio.length === 0,
    ecuacion: { intereses: n.intereses, gastos: n.gastos, perdidos: n.perdidos, ganancia: n.ganancia, aCasa: n.retirosCasa, reinvertido: n.reinvertido },
    filtros,
    formulario: {
      cuentasNegocio,
      cuentasCasa: cuentasDeGrupo(datos, "CASA"),
      fechaPorDefecto: fechaPorDefecto(datos.mes, datos.hoy),
      avisoSinSaldo: config.CUENTA_SIN_SALDO?.activa ?? true,
    },
    libro,
    sinCuenta,
  };
}

/** Manual movement as a book row, or null when it touches no business account. */
function filaManual(m: MovimientoManual, idsNegocio: ReadonlySet<string>, nombre: (id: string | null) => string): FilaBase | null {
  const sale = m.cuentaOrigenId !== null && idsNegocio.has(m.cuentaOrigenId);
  const entra = m.cuentaDestinoId !== null && idsNegocio.has(m.cuentaDestinoId);
  if (!sale && !entra) return null;
  const efectoPorCuenta: Record<string, number> = {};
  if (sale) efectoPorCuenta[m.cuentaOrigenId!] = -m.monto;
  if (entra) efectoPorCuenta[m.cuentaDestinoId!] = (efectoPorCuenta[m.cuentaDestinoId!] ?? 0) + m.monto;
  const efecto = (sale ? -m.monto : 0) + (entra ? m.monto : 0);

  const TIPO: Partial<Record<MovimientoManual["tipo"], string>> = {
    GASTO_NEGOCIO: "Gasto del negocio",
    APORTE: "Aporte",
    RETIRO_CASA: "Retiro a la casa",
    TRASLADO: "Traslado",
  };
  const ruta = `${nombre(m.cuentaOrigenId) || "Fuera del negocio"} → ${nombre(m.cuentaDestinoId)}`;
  const detalle =
    m.tipo === "RETIRO_CASA"
      ? `Hacia ${nombre(m.cuentaDestinoId)}`
      : m.tipo === "TRASLADO"
        ? (m.nota ? `${ruta} · ${m.nota}` : ruta)
        : (m.nota ?? "");
  return {
    key: `mov:${m.id}`,
    fecha: m.fecha,
    dia: Number(m.fecha.slice(8, 10)),
    origen: "manual",
    tipo: TIPO[m.tipo] ?? "Movimiento",
    detalle,
    dueno: null,
    cuentaTexto: sale && entra ? `${nombre(m.cuentaOrigenId)} → ${nombre(m.cuentaDestinoId)}` : sale ? nombre(m.cuentaOrigenId) : nombre(m.cuentaDestinoId),
    cuentas: Object.keys(efectoPorCuenta),
    capital: null,
    interes: null,
    efecto,
    montoNeutral: efecto === 0 ? m.monto : null,
    efectoPorCuenta,
    asignacion: null,
    editable: editableDe(m),
    orden: `1:${m.creadoEn}`,
  };
}

/**
 * Counting status under an account filter, as the canvas words it:
 * «Faltan $ 50.000» / «Sobran …» when the last arqueo did not match,
 * «Cuadró el 23» when it did, «Sin contar» before the first one.
 */
function estadoConteo(datos: CasaNegocioMes, cuentaId: string): Pick<FiltroCuenta, "detalle" | "tono"> {
  for (const arqueo of datos.arqueos) {
    const d = arqueo.detalles.find((x) => x.cuentaId === cuentaId);
    if (!d) continue;
    if (d.diferencia === 0) {
      const dia = diaBogotaDeInstante(arqueo.fecha);
      const mismoMes = dia.slice(0, 7) === datos.hoy.slice(0, 7);
      return { detalle: `Cuadró el ${Number(dia.slice(8, 10))}${mismoMes ? "" : ` de ${nombreDelMes(dia.slice(0, 7))}`}`, tono: "ok" };
    }
    return { detalle: `${d.diferencia < 0 ? "Faltan" : "Sobran"} ${fmt(d.diferencia)}`, tono: "problema" };
  }
  return { detalle: "Sin contar", tono: "neutral" };
}
