import {
  buscarSiguienteQuincena,
  calcularDiasInclusivos,
  calcularEstadoPorFecha,
  obtenerFinDeMes,
  normalizarFechaSinHora,
} from "./fechas-pago";

import type {
  CuotaSimulada,
  EntradaSimuladorCredito,
  FrecuenciaPago,
} from "./tipos";

/**
 * Genera el cronograma financiero simulado.
 *
 * Esta función es el reemplazo estructurado de `generarCronograma` en Apps Script.
 *
 * Decisiones importantes:
 * - No accede a React.
 * - No accede a Prisma.
 * - No escribe en base de datos.
 * - No usa SpreadsheetApp.
 * - No depende obligatoriamente de la fecha actual: acepta `fechaReferencia`.
 *
 * Esto permite usarla en:
 * - tests,
 * - simulador visual,
 * - backend,
 * - futuros procesos de guardado de crédito.
 */
export function generarCronogramaSimulado(
  entrada: EntradaSimuladorCredito,
): CuotaSimulada[] {
  validarEntradaSimulador(entrada);

  if (entrada.tipoAmortizacion === "Solo Interés") {
    return calcularCuotasSoloInteres(entrada);
  }

  if (entrada.frecuencia === "Mensual") {
    return calcularCuotasMensuales(entrada);
  }

  if (esFrecuenciaQuincenal(entrada.frecuencia)) {
    return calcularCuotasQuincenales(entrada);
  }

  throw new Error(`Frecuencia no reconocida: ${entrada.frecuencia satisfies never}`);
}

/**
 * Calcula cuotas mensuales para amortización fija.
 *
 * Regla heredada:
 * - Interés mensual fijo calculado sobre el capital inicial.
 * - Capital programado fijo = monto / plazo.
 * - Última cuota ajusta capital restante para eliminar residuos decimales.
 * - Primera fecha mensual se calcula con fin de mes y regla de salto <= 6 días.
 */
function calcularCuotasMensuales(
  credito: EntradaSimuladorCredito,
): CuotaSimulada[] {
  const cuotas: CuotaSimulada[] = [];

  let capitalRestante = credito.monto;
  const tasaMensual = credito.tasaMensual;
  const plazoMeses = credito.plazoMeses;
  const fechaPrestamo = normalizarFechaSinHora(credito.fechaPrestamo);

  if (!Number.isInteger(plazoMeses)) {
    throw new Error(
      "La frecuencia mensual requiere plazoMeses entero. Para fracciones de mes usa frecuencia quincenal.",
    );
  }

  const interesPleno = capitalRestante * tasaMensual;
  const abonoPleno = capitalRestante / plazoMeses;

  const fechaPrimerPago = obtenerFinDeMes(fechaPrestamo);
  const diasInclusivos = calcularDiasInclusivos(fechaPrestamo, fechaPrimerPago);

  /**
   * Regla heredada:
   * - Si faltan <= 6 días para el corte, se salta al siguiente periodo.
   * - Si no, se usa el siguiente fin de mes según la fórmula histórica.
   */
  const offsetMes = diasInclusivos <= 6 ? 2 : 1;

  for (let i = 1; i <= plazoMeses; i++) {
    const mesObjetivo = fechaPrestamo.getMonth() + offsetMes + (i - 1);

    /**
     * Fórmula heredada del Apps Script:
     * new Date(anio, mesObjetivo + 1, 0)
     * Esto devuelve el último día del mes objetivo.
     */
    const fechaProgramada = new Date(
      fechaPrestamo.getFullYear(),
      mesObjetivo + 1,
      0,
    );

    const capitalProgramado = i === plazoMeses ? capitalRestante : abonoPleno;
    const interesProgramado = interesPleno;
    const valorCuota = capitalProgramado + interesProgramado;

    capitalRestante -= capitalProgramado;

    cuotas.push(
      construirCuota({
        credito,
        numeroCuota: i,
        fechaProgramada,
        valorCuota,
        capitalProgramado,
        interesProgramado,
        saldoCapitalPost: limpiarResiduoCero(capitalRestante),
      }),
    );
  }

  return cuotas;
}

/**
 * Calcula cuotas quincenales para amortización fija.
 *
 * Regla heredada:
 * - Cantidad de cuotas = plazo_meses * 2.
 * - Interés quincenal = interés mensual pleno / 2.
 * - Capital quincenal = abono mensual pleno / 2.
 * - Última cuota ajusta capital restante.
 * - Calendarios soportados: 15/30, 5/20, 10/25.
 */
function calcularCuotasQuincenales(
  credito: EntradaSimuladorCredito,
): CuotaSimulada[] {
  const cuotas: CuotaSimulada[] = [];

  if (!esFrecuenciaQuincenal(credito.frecuencia)) {
    throw new Error(`Frecuencia quincenal inválida: ${credito.frecuencia}`);
  }

  let capitalRestante = credito.monto;
  const plazoQuincenas = credito.plazoMeses * 2;
  const fechaPrestamo = normalizarFechaSinHora(credito.fechaPrestamo);

  if (!Number.isInteger(plazoQuincenas)) {
    throw new Error(
      "El plazo quincenal debe producir un número entero de cuotas. Ejemplo: 2.5 meses => 5 quincenas.",
    );
  }

  const interesPlenoMensual = capitalRestante * credito.tasaMensual;
  const abonoPlenoMensual = capitalRestante / credito.plazoMeses;

  const interesQuincenal = interesPlenoMensual / 2;
  const abonoQuincenal = abonoPlenoMensual / 2;

  let proximaFecha = buscarSiguienteQuincena(
    fechaPrestamo,
    credito.frecuencia,
  );

  const diasInclusivos = calcularDiasInclusivos(fechaPrestamo, proximaFecha);

  if (diasInclusivos <= 6) {
    proximaFecha = buscarSiguienteQuincena(proximaFecha, credito.frecuencia);
  }

  let fechaActualPago = proximaFecha;

  for (let i = 1; i <= plazoQuincenas; i++) {
    if (i > 1) {
      fechaActualPago = buscarSiguienteQuincena(
        fechaActualPago,
        credito.frecuencia,
      );
    }

    let capitalProgramado = abonoQuincenal;

    /**
     * Ajuste final:
     * evita que residuos decimales de capital queden vivos por acumulación.
     */
    if (i === plazoQuincenas) {
      capitalProgramado = capitalRestante;
    }

    const interesProgramado = interesQuincenal;
    const valorCuota = capitalProgramado + interesProgramado;

    capitalRestante -= capitalProgramado;

    cuotas.push(
      construirCuota({
        credito,
        numeroCuota: i,
        fechaProgramada: new Date(fechaActualPago),
        valorCuota,
        capitalProgramado,
        interesProgramado,
        saldoCapitalPost: limpiarResiduoCero(capitalRestante),
      }),
    );
  }

  return cuotas;
}

/**
 * Calcula cronograma de solo interés.
 *
 * Regla heredada:
 * - El capital permanece congelado hasta la última cuota.
 * - Todas las cuotas pagan interés.
 * - La última cuota paga interés + capital.
 * - Si es quincenal, tasa aplicada = tasa mensual / 2.
 */
/**
 * Calcula cronograma de solo interés.
 *
 * Regla heredada:
 * - El capital permanece congelado hasta la última cuota.
 * - Todas las cuotas pagan interés.
 * - La última cuota paga interés + capital.
 * - Si es quincenal, tasa aplicada = tasa mensual / 2.
 */
function calcularCuotasSoloInteres(
  credito: EntradaSimuladorCredito,
): CuotaSimulada[] {
  const cuotas: CuotaSimulada[] = [];

  let capitalRestante = credito.monto;
  const fechaPrestamo = normalizarFechaSinHora(credito.fechaPrestamo);

  /**
   * TypeScript no infiere de forma estable que credito.frecuencia deja de ser
   * "Mensual" solo por guardar el resultado booleano en `esQuincenal`.
   *
   * Por eso creamos una variable explícita:
   * - Si la frecuencia es quincenal, contiene la frecuencia ya estrechada.
   * - Si no, queda en null.
   *
   * Esto evita casts peligrosos y mantiene el contrato estricto de
   * buscarSiguienteQuincena().
   */
  const frecuenciaQuincenal = esFrecuenciaQuincenal(credito.frecuencia)
    ? credito.frecuencia
    : null;

  const esQuincenal = frecuenciaQuincenal !== null;

  const totalEventos = esQuincenal
    ? credito.plazoMeses * 2
    : credito.plazoMeses;

  if (!Number.isInteger(totalEventos)) {
    throw new Error(
      "El plazo genera una cantidad no entera de eventos para la modalidad Solo Interés.",
    );
  }

  const tasaAplicada = esQuincenal
    ? credito.tasaMensual / 2
    : credito.tasaMensual;

  const interesPeriodo = capitalRestante * tasaAplicada;

  const fechaBasePago = esQuincenal
    ? buscarSiguienteQuincena(fechaPrestamo, frecuenciaQuincenal)
    : obtenerFinDeMes(fechaPrestamo);

  const diasInclusivos = calcularDiasInclusivos(fechaPrestamo, fechaBasePago);

  let fechaActualParaBucle: Date;

  if (diasInclusivos <= 6) {
    if (esQuincenal) {
      fechaActualParaBucle = buscarSiguienteQuincena(
        fechaBasePago,
        frecuenciaQuincenal,
      );
    } else {
      fechaActualParaBucle = new Date(
        fechaBasePago.getFullYear(),
        fechaBasePago.getMonth() + 2,
        0,
      );
    }
  } else {
    fechaActualParaBucle = fechaBasePago;
  }

  for (let i = 1; i <= totalEventos; i++) {
    const fechaProgramada = new Date(fechaActualParaBucle);

    /**
     * Se avanza la fecha después de capturar la fecha de la cuota actual.
     * Este orden replica el Apps Script original.
     */
    if (esQuincenal) {
      fechaActualParaBucle = buscarSiguienteQuincena(
        fechaActualParaBucle,
        frecuenciaQuincenal,
      );
    } else {
      fechaActualParaBucle = new Date(
        fechaActualParaBucle.getFullYear(),
        fechaActualParaBucle.getMonth() + 2,
        0,
      );
    }

    const capitalProgramado = i === totalEventos ? capitalRestante : 0;
    const interesProgramado = interesPeriodo;
    const valorCuota = capitalProgramado + interesProgramado;
    const saldoCapitalPost = Math.max(0, capitalRestante - capitalProgramado);

    cuotas.push(
      construirCuota({
        credito,
        numeroCuota: i,
        fechaProgramada,
        valorCuota,
        capitalProgramado,
        interesProgramado,
        saldoCapitalPost,
      }),
    );
  }

  return cuotas;
}

interface ConstruirCuotaParams {
  credito: EntradaSimuladorCredito;
  numeroCuota: number;
  fechaProgramada: Date;
  valorCuota: number;
  capitalProgramado: number;
  interesProgramado: number;
  saldoCapitalPost: number;
}

/**
 * Construye la cuota simulada en un solo punto.
 *
 * Esto evita repetir campos comunes en los tres motores:
 * mensual, quincenal y solo interés.
 */
function construirCuota(params: ConstruirCuotaParams): CuotaSimulada {
  const fechaReferencia =
    params.credito.fechaReferencia ?? normalizarFechaSinHora(new Date());

  return {
    idCredito: params.credito.idCredito,
    cliente: params.credito.cliente,
    cedula: params.credito.cedula,

    numeroCuota: params.numeroCuota,
    tipoPago: "CUOTA_PROGRAMADA",

    fechaProgramada: normalizarFechaSinHora(params.fechaProgramada),

    valorCuota: params.valorCuota,
    capitalProgramado: params.capitalProgramado,
    interesProgramado: params.interesProgramado,

    saldoCapitalPost: Math.max(0, params.saldoCapitalPost),

    estado: calcularEstadoPorFecha(params.fechaProgramada, fechaReferencia),
    montoPagado: 0,
  };
}

/**
 * Valida entradas duras del simulador.
 *
 * Estas validaciones reemplazan la tolerancia implícita de Sheets.
 * Si la entrada no es válida, el motor debe fallar temprano.
 */
function validarEntradaSimulador(entrada: EntradaSimuladorCredito): void {
  if (!(entrada.fechaPrestamo instanceof Date)) {
    throw new Error("fechaPrestamo debe ser una instancia Date.");
  }

  if (Number.isNaN(entrada.fechaPrestamo.getTime())) {
    throw new Error("fechaPrestamo no es una fecha válida.");
  }

  if (!Number.isFinite(entrada.monto) || entrada.monto <= 0) {
    throw new Error("El monto debe ser un número mayor a cero.");
  }

  if (!Number.isFinite(entrada.plazoMeses) || entrada.plazoMeses <= 0) {
    throw new Error("El plazo en meses debe ser un número mayor a cero.");
  }

  if (!Number.isFinite(entrada.tasaMensual) || entrada.tasaMensual <= 0) {
    throw new Error("La tasa mensual debe ser un número mayor a cero.");
  }

  if (!esFrecuenciaValida(entrada.frecuencia)) {
    throw new Error(`Frecuencia inválida: ${entrada.frecuencia}`);
  }

  if (
    entrada.tipoAmortizacion !== "Amortización Fija" &&
    entrada.tipoAmortizacion !== "Solo Interés"
  ) {
    throw new Error(`Tipo de amortización inválido: ${entrada.tipoAmortizacion}`);
  }
}

function esFrecuenciaValida(frecuencia: string): frecuencia is FrecuenciaPago {
  return (
    frecuencia === "Mensual" ||
    frecuencia === "Quincenal 15/30" ||
    frecuencia === "Quincenal 5/20" ||
    frecuencia === "Quincenal 10/25"
  );
}

function esFrecuenciaQuincenal(
  frecuencia: FrecuenciaPago,
): frecuencia is Extract<
  FrecuenciaPago,
  "Quincenal 15/30" | "Quincenal 5/20" | "Quincenal 10/25"
> {
  return frecuencia.startsWith("Quincenal");
}

/**
 * Limpia residuos extremadamente pequeños provocados por aritmética binaria.
 *
 * No redondea cuotas. Solo evita saldos como:
 * 1.4551915228366852e-11
 */
function limpiarResiduoCero(valor: number): number {
  return Math.abs(valor) < 0.000001 ? 0 : Math.max(0, valor);
}
