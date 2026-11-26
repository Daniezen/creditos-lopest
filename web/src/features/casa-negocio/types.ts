/**
 * Read contract of the Casa y Negocio module: what `obtenerCasaNegocioMes`
 * (src/server/casa-negocio/queries.ts) returns for one month and one viewer,
 * and what the tabs consume.
 *
 * Every type is PLAIN DATA, safe to pass from a Server Component to a Client
 * Component: no Prisma.Decimal (money is `number` in pesos, at most two
 * decimals), no Date (calendar days are `YYYY-MM-DD` in America/Bogota,
 * instants are ISO strings), no class instances. Row versions (`version`)
 * are the `actualizadoEn.toISOString()` the edit forms must send back for
 * the optimistic lock.
 *
 * Everything is recalculated from the live rows on every read; nothing in
 * here is a frozen monthly snapshot (spec §3).
 */

// ---------------------------------------------------------------------------
// Enums (string unions mirroring the Prisma enums)
// ---------------------------------------------------------------------------

export type GrupoCuenta = "NEGOCIO" | "CASA";
export type TipoCuenta = "EFECTIVO" | "BANCO" | "BILLETERA" | "AHORRO";
export type TipoMovimiento =
  | "GASTO_NEGOCIO"
  | "APORTE"
  | "RETIRO_CASA"
  | "TRASLADO"
  | "GASTO_FIJO"
  | "GASTO_VARIABLE"
  | "INGRESO_CASA";
export type ClaseGasto = "FIJO" | "VARIABLE";
export type Periodicidad = "MENSUAL" | "ANUAL";
export type Capacidad = "VER" | "ANOTAR" | "CONTAR" | "CONFIGURAR";
export type CodigoAviso =
  | "FIJO_VENCIDO_SIN_PAGAR"
  | "SOBRE_CERCA_DEL_TOPE"
  | "SOBRES_CIERRE_NEGATIVO"
  | "CUENTA_SIN_CONTAR"
  | "ARQUEO_NO_CUADRA"
  | "RETIRO_SUPERA_GANANCIA"
  | "MOVIMIENTO_DEJA_SIN_SALDO"
  | "CREDITO_SIN_PAGOS"
  | "GASTO_ANUAL_PROXIMO"
  | "CIERRE_SOBRANTE_SIN_AHORRO";
export type EstadoCuota = "PENDIENTE" | "ATRASADO" | "MORA";
/** Delinquency buckets of the portfolio ("cómo está pagando la cartera"). */
export type TramoAtraso = "AL_DIA" | "1_30" | "31_60" | "61_90" | "MAS_90";

/** `YYYY-MM-DD`, a calendar day in America/Bogota. */
export type FechaDia = string;
/** `YYYY-MM`. */
export type Mes = string;
/** ISO 8601 instant (`2026-12-05T14:03:00.000Z`). */
export type Instante = string;

/** A person shown next to something they did or own. */
export interface PersonaRef {
  id: string;
  nombre: string;
}

/**
 * Owner labelling of loan-derived rows: the father sees every loan, and the
 * ones owned by someone else must be clearly marked (and are read-only in
 * Créditos).
 */
export interface DuenoCredito {
  /** `Credito.ownerUserId`'s user, null for legacy loans without owner. */
  dueno: PersonaRef | null;
  /** True when the viewer owns the loan. */
  esPropio: boolean;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface CuentaMes {
  id: string;
  nombre: string;
  grupo: GrupoCuenta;
  tipo: TipoCuenta;
  orden: number;
  archivada: boolean;
  saldoInicial: number;
  fechaSaldoInicial: FechaDia;
  /** Balance at the first instant of the month. */
  saldoInicioMes: number;
  entradasMes: number;
  salidasMes: number;
  /** Balance at the end of the month (equals `saldoActual` for the current month). */
  saldoFinMes: number;
  /** Balance with everything recorded up to now. */
  saldoActual: number;
  /** Moment of the last arqueo that counted this account, null if never counted. */
  ultimoArqueo: Instante | null;
  version: Instante;
}

// ---------------------------------------------------------------------------
// Manual and automatic movements
// ---------------------------------------------------------------------------

export interface MovimientoManual {
  id: string;
  tipo: TipoMovimiento;
  fecha: FechaDia;
  monto: number;
  cuentaOrigenId: string | null;
  cuentaDestinoId: string | null;
  categoriaId: string | null;
  nota: string | null;
  /** Who recorded or last edited it. */
  accionPor: PersonaRef | null;
  creadoEn: Instante;
  version: Instante;
}

/** A paid installment or abono (money IN, automatic "L" row). */
export interface CobroMes extends DuenoCredito {
  eventoFinancieroId: string;
  creditoId: string;
  creditoCodigo: string;
  clienteNombre: string;
  tipo: "CUOTA" | "ABONO";
  numeroCuota: number | null;
  fechaPago: FechaDia;
  capital: number;
  interes: number;
  /** Cash that came in. */
  total: number;
  /** Assigned account, null while "sin cuenta". */
  cuentaId: string | null;
  /** Version of the assignment, to send back when changing it. */
  asignacionVersion: Instante | null;
  /** False before the module start: it stays "sin cuenta" for good. */
  asignable: boolean;
}

/** A loan disbursement (money OUT, automatic "L" row). */
export interface DesembolsoMes extends DuenoCredito {
  creditoId: string;
  creditoCodigo: string;
  clienteNombre: string;
  fecha: FechaDia;
  monto: number;
  cuentaId: string | null;
  asignacionVersion: Instante | null;
  asignable: boolean;
}

// ---------------------------------------------------------------------------
// What is still to be collected
// ---------------------------------------------------------------------------

/** An unpaid installment: overdue ones plus those due up to the end of the month. */
export interface CuotaPorCobrar extends DuenoCredito {
  eventoFinancieroId: string;
  creditoId: string;
  creditoCodigo: string;
  clienteNombre: string;
  numeroCuota: number | null;
  fechaProgramada: FechaDia;
  estado: EstadoCuota;
  /** Still owed on this installment (scheduled value minus what was paid). */
  pendiente: number;
  capital: number;
  interes: number;
  /** Days past due as of today (0 when not yet due). */
  diasAtraso: number;
  vencida: boolean;
}

/** Scheduled collections of a future month, from unpaid installments. */
export interface ProyeccionMes {
  mes: Mes;
  capital: number;
  interes: number;
  total: number;
  cuotas: number;
}

/** "Lo que tocaba cobrar" in the selected month vs what was collected of it. */
export interface TocabaCobrar {
  cuotas: number;
  pagadas: number;
  programado: number;
  capitalProgramado: number;
  interesProgramado: number;
  /** Of the installments due this month, how much has been paid (any date). */
  cobradoDeLoProgramado: number;
}

// ---------------------------------------------------------------------------
// Portfolio ("en la calle")
// ---------------------------------------------------------------------------

export interface CreditoCartera extends DuenoCredito {
  creditoId: string;
  creditoCodigo: string;
  clienteNombre: string;
  saldoCapital: number;
  diasAtraso: number;
  tramo: TramoAtraso;
  /** Sum still owed on overdue installments. */
  montoVencido: number;
  ultimoPago: FechaDia | null;
  /** Days since the last payment (or since the loan, if never paid). */
  diasSinPago: number;
  /** Written off ("préstamo perdido"): shown apart, not counted in `enLaCalle`. */
  castigado: boolean;
}

export interface TramoCartera {
  tramo: TramoAtraso;
  creditos: number;
  saldoCapital: number;
  montoVencido: number;
}

export interface CarteraResumen {
  /** Outstanding principal of active, not written-off loans. Shown apart, never added to the family money. */
  enLaCalle: number;
  creditosActivos: number;
  tramos: TramoCartera[];
  creditos: CreditoCartera[];
}

// ---------------------------------------------------------------------------
// Household expenses
// ---------------------------------------------------------------------------

export interface CategoriaMes {
  id: string;
  nombre: string;
  clase: ClaseGasto;
  /** FIJO: expected amount. VARIABLE: monthly cap. Null when not set. */
  monto: number | null;
  periodicidad: Periodicidad;
  mesAnual: number | null;
  diaPago: number | null;
  activa: boolean;
  orden: number;
  gastadoMes: number;
  movimientosMes: number;
  /** Whether it falls due in the selected month (monthly: always; annual: in its month). */
  venceEnMes: boolean;
  /** Due day inside the selected month, when it falls due and has a day. */
  fechaPagoMes: FechaDia | null;
  /** Something was booked against it this month. */
  pagadoMes: boolean;
  /** Next due day from today on (annual expenses and monthly with a day). */
  proximoVencimiento: FechaDia | null;
  version: Instante;
}

// ---------------------------------------------------------------------------
// Write-offs, arqueos, history
// ---------------------------------------------------------------------------

export interface CastigoActivo {
  id: string;
  creditoId: string;
  creditoCodigo: string;
  clienteNombre: string;
  monto: number;
  fecha: FechaDia;
  motivo: string;
  version: Instante;
}

export interface ArqueoDetalle {
  cuentaId: string;
  saldoSistema: number;
  contado: number;
  /** contado - saldoSistema; 0 means it matched. */
  diferencia: number;
}

export interface ArqueoRegistro {
  id: string;
  fecha: Instante;
  accionPor: PersonaRef | null;
  nota: string | null;
  detalles: ArqueoDetalle[];
}

/** Monthly totals for Resumen ("mes a mes") and Ahorro ("depósitos por mes"). */
export interface HistorialMes {
  mes: Mes;
  capitalCobrado: number;
  interesCobrado: number;
  totalCobrado: number;
  desembolsado: number;
  gastosNegocio: number;
  aportes: number;
  retirosCasa: number;
  /** Write-offs dated in the month (not reverted). */
  perdidas: number;
  ingresosCasa: number;
  gastosFijos: number;
  gastosVariables: number;
  /** Transfers into AHORRO accounts from other accounts. */
  depositosAhorro: number;
  /** Transfers out of AHORRO accounts into other accounts. */
  retirosAhorro: number;
}

// ---------------------------------------------------------------------------
// Settings and permissions
// ---------------------------------------------------------------------------

export interface ReglaAviso {
  codigo: CodigoAviso;
  activa: boolean;
  umbral: number | null;
  version: Instante;
}

export interface ConfiguracionModulo {
  metaAsignacionCasa: number | null;
  metaAhorro: number | null;
  cuentaAhorroId: string | null;
  version: Instante;
  reglas: ReglaAviso[];
}

/** A closed month's leftover and how much of it reached savings (alert 10). */
export interface CierreAnterior {
  mes: Mes;
  /** House «al cierre» of that month, whole pesos (may be negative). */
  sobrante: number;
  /** Sum of the live «Pasar al ahorro» movements of that month's cierre. */
  pasadoAlAhorro: number;
}

export interface PermisoPersona {
  userId: string;
  nombre: string;
  capacidades: Capacidad[];
}

// ---------------------------------------------------------------------------
// The whole month
// ---------------------------------------------------------------------------

export interface CasaNegocioMes {
  mes: Mes;
  /** Today in Bogota, so the UI and the domain engine agree on "hoy". */
  hoy: FechaDia;
  /** Earliest opening date of the accounts (the module start), null without accounts. */
  inicioModulo: FechaDia | null;
  usuario: PersonaRef & { capacidades: Capacidad[] };

  cuentas: CuentaMes[];
  /** Manual movements of the month, oldest first. */
  movimientos: MovimientoManual[];
  /** Paid installments and abonos of the month (by fechaPago), oldest first. */
  cobros: CobroMes[];
  /** Disbursements of the month (by fechaPrestamo), oldest first. */
  desembolsos: DesembolsoMes[];
  /** Assignable automatic movements of ANY month still without account. */
  sinCuenta: { cobros: CobroMes[]; desembolsos: DesembolsoMes[] };

  cuotasPorCobrar: CuotaPorCobrar[];
  tocabaCobrar: TocabaCobrar;
  /** The selected month and the five after it. */
  proyeccion: ProyeccionMes[];
  cartera: CarteraResumen;

  categorias: CategoriaMes[];
  castigos: CastigoActivo[];
  /** Most recent first (last 24). */
  arqueos: ArqueoRegistro[];
  /** Twelve months ending at the selected one, oldest first. */
  historial: HistorialMes[];

  configuracion: ConfiguracionModulo;
  /**
   * The cierre of the month before today's, for alert 10 on the Tablero:
   * its house «al cierre» (spec §3, the same figure Ahorro proposes) and what
   * «Pasar al ahorro» already moved for it (cierre movements only). Present
   * only when the month read is today's and that month is inside the module;
   * optional so older fixtures without it keep compiling.
   */
  cierreAnterior?: CierreAnterior | null;
  /** Only for viewers with CONFIGURAR; null otherwise. */
  permisos: PermisoPersona[] | null;
}
