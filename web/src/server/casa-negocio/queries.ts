/**
 * Read side of Casa y Negocio: everything the tabs need for one month and one
 * viewer, as the plain types of `@/features/casa-negocio/types`.
 *
 * SCOPE. Two different rules apply, on purpose:
 *   * Loan-derived lists (cobros, desembolsos, cuotas, cartera, castigos and
 *     the history built from them) follow the viewer's loan scope through the
 *     existing helpers of `@/server/auth/scope` (ADMIN sees every owner, the
 *     rest only their own loans), and every row says who owns it.
 *   * Account balances are module-wide (see `saldos.ts`): an account is a
 *     physical place and its balance cannot depend on who is looking.
 *
 * DATES. Cobros belong to the month of their `fechaPago`, disbursements to
 * the month of `fechaPrestamo`, movements to `fecha`, all in America/Bogota
 * (`rangoMes`). "Hoy" is computed once per read and returned, so the UI and
 * the domain engine use the same day.
 *
 * Nothing is cached or frozen: each call recalculates from the live rows.
 */
import type { CnCapacidad, Prisma, PrismaClient } from "@prisma/client";

import { calcularSaldoCapitalActual } from "@/features/creditos/current-capital-balance";
import { fechaClave, mesClave, parseMes, rangoMes, sumarMeses, diasEntre } from "@/features/casa-negocio/mes";
import { CAPACIDADES, CODIGOS_AVISO } from "@/features/casa-negocio/schemas";
import type {
  ArqueoRegistro,
  CasaNegocioMes,
  CategoriaMes,
  CierreAnterior,
  CobroMes,
  CreditoCartera,
  CuentaMes,
  CuotaPorCobrar,
  DesembolsoMes,
  DuenoCredito,
  MovimientoManual,
  PersonaRef,
  ProyeccionMes,
  TramoCartera,
} from "@/features/casa-negocio/types";
import {
  buildCreditoVisibilityWhere,
  buildEventoFinancieroVisibilityWhere,
  type CurrentUserScope,
} from "@/server/auth/scope";

import { TRAMOS, categoriaDelMes, construirHistorial, tramoDe } from "./agregados";
import { requireCapacidad } from "./capacidades";
import { aCentavos, aPesos, sumar } from "./dinero";
import { CasaNegocioReglaError } from "./errors";
import { cargarAsientos, desgloseCobro, resumirSaldo } from "./saldos";
import { mesDeClaveCierre } from "./vista-ahorro";
import { alCierreCasa } from "./vista-mes";

/** Viewer of the read: loan scope (id + roles) plus module capabilities. */
export interface LectorCasaNegocio extends CurrentUserScope {
  nombre: string;
  capacidades: ReadonlySet<CnCapacidad>;
}

type Db = PrismaClient | Prisma.TransactionClient;

const ESTADOS_POR_COBRAR = ["PENDIENTE", "ATRASADO", "MORA"] as const;
const MESES_PROYECCION = 6;
const ARQUEOS_RECIENTES = 24;

const CREDITO_REF = {
  id: true,
  codigo: true,
  ownerUserId: true,
  ownerUser: { select: { id: true, nombre: true } },
  cliente: { select: { nombre: true } },
} as const;

interface CreditoRef {
  id: string;
  codigo: string;
  ownerUserId: string | null;
  ownerUser: { id: string; nombre: string } | null;
  cliente: { nombre: string };
}

function duenoDe(credito: CreditoRef, lector: CurrentUserScope): DuenoCredito {
  return { dueno: credito.ownerUser, esPropio: credito.ownerUserId === lector.id };
}

/**
 * Entry point for Server Components: authenticates, demands
 * `casa_negocio.ver` and loads the month. `mes` is `YYYY-MM`.
 */
export async function obtenerCasaNegocioMes(mes: string): Promise<CasaNegocioMes> {
  const actor = await requireCapacidad("VER");
  const { prisma } = await import("@/lib/prisma");
  return cargarCasaNegocioMes(prisma, actor, mes);
}

/**
 * Loads the month for an already-authorized viewer. Exported for the
 * integration test and for scripts; app code goes through
 * `obtenerCasaNegocioMes`.
 */
export async function cargarCasaNegocioMes(
  db: Db,
  lector: LectorCasaNegocio,
  mes: string,
  ahora: Date = new Date(),
): Promise<CasaNegocioMes> {
  if (!parseMes(mes)) throw new CasaNegocioReglaError("El mes no es válido (AAAA-MM).");

  const hoy = fechaClave(ahora);
  const { inicio, fin } = rangoMes(mes);
  const inicioHistorial = rangoMes(sumarMeses(mes, -11)).inicio;
  const finProyeccion = rangoMes(sumarMeses(mes, MESES_PROYECCION - 1)).fin;

  const cuentasRows = await db.cnCuenta.findMany({ orderBy: [{ grupo: "asc" }, { orden: "asc" }, { nombre: "asc" }] });

  // Automatic movements become assignable from the first business account's
  // opening date (spec: what came before 1-dic stays "sin cuenta").
  const aperturasNegocio = cuentasRows.filter((c) => c.grupo === "NEGOCIO").map((c) => c.fechaSaldoInicial.getTime());
  const inicioNegocio = aperturasNegocio.length > 0 ? new Date(Math.min(...aperturasNegocio)) : null;
  const aperturas = cuentasRows.map((c) => c.fechaSaldoInicial.getTime());
  const inicioModulo = aperturas.length > 0 ? fechaClave(new Date(Math.min(...aperturas))) : null;
  const inicioAutomaticos =
    inicioNegocio && inicioNegocio.getTime() < inicioHistorial.getTime() ? inicioNegocio : inicioHistorial;
  const esAsignable = (fecha: Date) => inicioNegocio !== null && fecha.getTime() >= inicioNegocio.getTime();

  const creditoVisible = buildCreditoVisibilityWhere(lector);
  const eventoVisible: Prisma.EventoFinancieroWhereInput = {
    AND: [buildEventoFinancieroVisibilityWhere(lector), { credito: creditoVisible }],
  };
  const puedeConfigurar = lector.capacidades.has("CONFIGURAR");

  const [
    asientos,
    movimientosRows,
    pagadosRows,
    desembolsosRows,
    pendientesRows,
    programadosMesRows,
    carteraRows,
    categoriasRows,
    castigosRows,
    arqueosRows,
    ultimosArqueos,
    configRow,
    reglasRows,
    personasRows,
  ] = await Promise.all([
    cargarAsientos(db),
    db.cnMovimiento.findMany({
      where: { eliminadoEn: null, fecha: { gte: inicioHistorial, lt: fin } },
      orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
    }),
    db.eventoFinanciero.findMany({
      where: { ...eventoVisible, estado: "PAGADO", fechaPago: { gte: inicioAutomaticos } },
      orderBy: [{ fechaPago: "asc" }, { creadoEn: "asc" }],
      select: {
        id: true,
        tipo: true,
        numeroCuota: true,
        fechaPago: true,
        montoPagado: true,
        capitalPagado: true,
        interesPagado: true,
        capitalProgramado: true,
        interesProgramado: true,
        credito: { select: CREDITO_REF },
        cnAsignacion: { select: { cuentaId: true, actualizadoEn: true } },
      },
    }),
    db.credito.findMany({
      where: { ...creditoVisible, fechaPrestamo: { gte: inicioAutomaticos } },
      orderBy: [{ fechaPrestamo: "asc" }, { creadoEn: "asc" }],
      select: {
        ...CREDITO_REF,
        monto: true,
        fechaPrestamo: true,
        cnAsignacionDesembolso: { select: { cuentaId: true, actualizadoEn: true } },
      },
    }),
    db.eventoFinanciero.findMany({
      where: {
        AND: [eventoVisible, { credito: { cnCastigos: { none: { revertidoEn: null } } } }],
        tipo: "CUOTA_PROGRAMADA",
        estado: { in: [...ESTADOS_POR_COBRAR] },
        fechaProgramada: { lt: finProyeccion },
      },
      orderBy: [{ fechaProgramada: "asc" }, { numeroCuota: "asc" }],
      select: {
        id: true,
        numeroCuota: true,
        fechaProgramada: true,
        estado: true,
        diasAtraso: true,
        valorProgramado: true,
        capitalProgramado: true,
        interesProgramado: true,
        montoPagado: true,
        credito: { select: CREDITO_REF },
      },
    }),
    db.eventoFinanciero.findMany({
      where: {
        ...eventoVisible,
        tipo: "CUOTA_PROGRAMADA",
        estado: { not: "CANCELADO_POR_ABONO" },
        fechaProgramada: { gte: inicio, lt: fin },
      },
      select: { estado: true, valorProgramado: true, capitalProgramado: true, interesProgramado: true, montoPagado: true },
    }),
    db.credito.findMany({
      where: { ...creditoVisible, estado: "ACTIVO" },
      orderBy: { codigo: "asc" },
      select: {
        ...CREDITO_REF,
        monto: true,
        fechaPrestamo: true,
        cnCastigos: { where: { revertidoEn: null }, select: { id: true } },
        eventos: {
          select: {
            tipo: true,
            estado: true,
            fechaProgramada: true,
            fechaPago: true,
            diasAtraso: true,
            valorProgramado: true,
            montoPagado: true,
            capitalPagado: true,
            saldoCapitalPost: true,
          },
        },
      },
    }),
    db.cnCategoriaGasto.findMany({ orderBy: [{ clase: "asc" }, { orden: "asc" }, { nombre: "asc" }] }),
    db.cnCastigoCredito.findMany({
      where: { revertidoEn: null, credito: creditoVisible },
      orderBy: { fecha: "asc" },
      include: { credito: { select: CREDITO_REF } },
    }),
    db.cnArqueo.findMany({ orderBy: { fecha: "desc" }, take: ARQUEOS_RECIENTES, include: { detalles: true } }),
    db.$queryRaw<{ cuentaId: string; fecha: Date }[]>`
      SELECT d."cuentaId", MAX(a."fecha") AS "fecha"
        FROM "cn_arqueo_detalles" d
        JOIN "cn_arqueos" a ON a."id" = d."arqueoId"
       GROUP BY d."cuentaId"`,
    db.cnConfiguracion.findUnique({ where: { id: "default" } }),
    db.cnReglaAviso.findMany(),
    puedeConfigurar
      ? db.user.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, cnPermisos: { select: { capacidad: true } } },
        })
      : Promise.resolve(null),
  ]);

  // People named next to movements and arqueos.
  const idsPersonas = new Set<string>();
  for (const m of movimientosRows) idsPersonas.add(m.accionPor);
  for (const a of arqueosRows) idsPersonas.add(a.accionPor);
  const personas = new Map<string, PersonaRef>(
    (await db.user.findMany({ where: { id: { in: [...idsPersonas] } }, select: { id: true, nombre: true } })).map((u) => [
      u.id,
      u,
    ]),
  );

  // --- Accounts --------------------------------------------------------------
  const ultimoArqueoPorCuenta = new Map(ultimosArqueos.map((r) => [r.cuentaId, r.fecha]));
  const cuentas: CuentaMes[] = cuentasRows.map((c) => {
    const resumen = resumirSaldo(c, asientos, inicio, fin);
    return {
      id: c.id,
      nombre: c.nombre,
      grupo: c.grupo,
      tipo: c.tipo,
      orden: c.orden,
      archivada: c.archivada,
      saldoInicial: resumen.saldoInicial,
      fechaSaldoInicial: fechaClave(c.fechaSaldoInicial),
      saldoInicioMes: resumen.saldoInicio,
      entradasMes: resumen.entradas,
      salidasMes: resumen.salidas,
      saldoFinMes: resumen.saldoFin,
      saldoActual: resumen.saldoActual,
      ultimoArqueo: ultimoArqueoPorCuenta.get(c.id)?.toISOString() ?? null,
      version: c.actualizadoEn.toISOString(),
    };
  });
  const tipoCuenta = new Map(cuentasRows.map((c) => [c.id, c.tipo]));

  // --- Manual movements ------------------------------------------------------
  const enMes = (fecha: Date) => fecha.getTime() >= inicio.getTime() && fecha.getTime() < fin.getTime();
  const movimientosMesRows = movimientosRows.filter((m) => enMes(m.fecha));
  const aMovimiento = (m: (typeof movimientosRows)[number]): MovimientoManual => ({
    id: m.id,
    tipo: m.tipo,
    fecha: fechaClave(m.fecha),
    monto: aPesos(aCentavos(m.monto)),
    cuentaOrigenId: m.cuentaOrigenId,
    cuentaDestinoId: m.cuentaDestinoId,
    categoriaId: m.categoriaId,
    nota: m.nota,
    accionPor: personas.get(m.accionPor) ?? null,
    creadoEn: m.creadoEn.toISOString(),
    version: m.actualizadoEn.toISOString(),
  });
  const movimientos = movimientosMesRows.map(aMovimiento);

  // --- Automatic movements ---------------------------------------------------
  const cobrosTodos = pagadosRows.map((e) => {
    const fechaPago = e.fechaPago!; // filtered by `fechaPago: { gte }`, never null
    const { capital, interes, total } = desgloseCobro(e);
    const cobro: CobroMes = {
      eventoFinancieroId: e.id,
      creditoId: e.credito.id,
      creditoCodigo: e.credito.codigo,
      clienteNombre: e.credito.cliente.nombre,
      ...duenoDe(e.credito, lector),
      tipo: e.tipo === "ABONO_CAPITAL" ? "ABONO" : "CUOTA",
      numeroCuota: e.numeroCuota,
      fechaPago: fechaClave(fechaPago),
      capital,
      interes,
      total,
      cuentaId: e.cnAsignacion?.cuentaId ?? null,
      asignacionVersion: e.cnAsignacion?.actualizadoEn.toISOString() ?? null,
      asignable: esAsignable(fechaPago),
    };
    return { cobro, fecha: fechaPago };
  });
  const desembolsosTodos = desembolsosRows.map((c) => {
    const desembolso: DesembolsoMes = {
      creditoId: c.id,
      creditoCodigo: c.codigo,
      clienteNombre: c.cliente.nombre,
      ...duenoDe(c, lector),
      fecha: fechaClave(c.fechaPrestamo),
      monto: aPesos(aCentavos(c.monto)),
      cuentaId: c.cnAsignacionDesembolso?.cuentaId ?? null,
      asignacionVersion: c.cnAsignacionDesembolso?.actualizadoEn.toISOString() ?? null,
      asignable: esAsignable(c.fechaPrestamo),
    };
    return { desembolso, fecha: c.fechaPrestamo };
  });

  // --- Still to collect ------------------------------------------------------
  const pendientes = pendientesRows.map((e) => {
    const fechaProgramada = fechaClave(e.fechaProgramada);
    const vencida = fechaProgramada < hoy;
    const pendiente = Math.max(0, aCentavos(e.valorProgramado) - aCentavos(e.montoPagado));
    const cuota: CuotaPorCobrar = {
      eventoFinancieroId: e.id,
      creditoId: e.credito.id,
      creditoCodigo: e.credito.codigo,
      clienteNombre: e.credito.cliente.nombre,
      ...duenoDe(e.credito, lector),
      numeroCuota: e.numeroCuota,
      fechaProgramada,
      estado: e.estado as CuotaPorCobrar["estado"],
      pendiente: aPesos(pendiente),
      capital: aPesos(aCentavos(e.capitalProgramado)),
      interes: aPesos(aCentavos(e.interesProgramado)),
      // Same rule as analytics: the larger of the stored counter and the calendar.
      diasAtraso: vencida ? Math.max(e.diasAtraso, diasEntre(fechaProgramada, hoy)) : 0,
      vencida,
    };
    return { cuota, fecha: e.fechaProgramada };
  });
  const cuotasPorCobrar = pendientes.filter((p) => p.fecha.getTime() < fin.getTime()).map((p) => p.cuota);

  // Projection by due month. `capital`/`interes` are the scheduled split;
  // `total` is what is still owed (they differ only on partially paid cuotas).
  const proyeccion: ProyeccionMes[] = Array.from({ length: MESES_PROYECCION }, (_, i) => {
    const clave = sumarMeses(mes, i);
    const delMes = pendientes.filter((p) => mesClave(p.fecha) === clave).map((p) => p.cuota);
    return {
      mes: clave,
      capital: sumar(delMes.map((c) => c.capital)),
      interes: sumar(delMes.map((c) => c.interes)),
      total: sumar(delMes.map((c) => c.pendiente)),
      cuotas: delMes.length,
    };
  });

  const tocabaCobrar = {
    cuotas: programadosMesRows.length,
    pagadas: programadosMesRows.filter((e) => e.estado === "PAGADO").length,
    programado: sumar(programadosMesRows.map((e) => e.valorProgramado)),
    capitalProgramado: sumar(programadosMesRows.map((e) => e.capitalProgramado)),
    interesProgramado: sumar(programadosMesRows.map((e) => e.interesProgramado)),
    cobradoDeLoProgramado: sumar(programadosMesRows.map((e) => e.montoPagado)),
  };

  // --- Portfolio -------------------------------------------------------------
  const creditosCartera: CreditoCartera[] = carteraRows.map((c) => {
    let diasAtraso = 0;
    let vencido = 0;
    let ultimoPago: Date | null = null;
    for (const e of c.eventos) {
      if (e.estado === "PAGADO" && e.fechaPago && (!ultimoPago || e.fechaPago > ultimoPago)) ultimoPago = e.fechaPago;
      const porCobrar = (ESTADOS_POR_COBRAR as readonly string[]).includes(e.estado);
      if (e.tipo !== "CUOTA_PROGRAMADA" || !porCobrar) continue;
      const fp = fechaClave(e.fechaProgramada);
      if (fp >= hoy) continue;
      diasAtraso = Math.max(diasAtraso, e.diasAtraso, diasEntre(fp, hoy));
      vencido += Math.max(0, aCentavos(e.valorProgramado) - aCentavos(e.montoPagado));
    }
    return {
      creditoId: c.id,
      creditoCodigo: c.codigo,
      clienteNombre: c.cliente.nombre,
      ...duenoDe(c, lector),
      saldoCapital: calcularSaldoCapitalActual(c.monto, c.eventos),
      diasAtraso,
      tramo: tramoDe(diasAtraso),
      montoVencido: aPesos(vencido),
      ultimoPago: ultimoPago ? fechaClave(ultimoPago) : null,
      diasSinPago: Math.max(0, diasEntre(fechaClave(ultimoPago ?? c.fechaPrestamo), hoy)),
      castigado: c.cnCastigos.length > 0,
    };
  });
  const vivos = creditosCartera.filter((c) => !c.castigado);
  const tramos: TramoCartera[] = TRAMOS.map((tramo) => {
    const del = vivos.filter((c) => c.tramo === tramo);
    return {
      tramo,
      creditos: del.length,
      saldoCapital: sumar(del.map((c) => c.saldoCapital)),
      montoVencido: sumar(del.map((c) => c.montoVencido)),
    };
  });

  // --- Household categories --------------------------------------------------
  /** Categories with the figures of `mesCat`, from that month's movement rows. */
  const categoriasDe = (mesCat: string, rows: readonly (typeof movimientosRows)[number][]): CategoriaMes[] => {
    const montosPorCategoria = new Map<string, Prisma.Decimal[]>();
    for (const m of rows) {
      if (!m.categoriaId) continue;
      const lista = montosPorCategoria.get(m.categoriaId) ?? [];
      lista.push(m.monto);
      montosPorCategoria.set(m.categoriaId, lista);
    }
    return categoriasRows.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    clase: c.clase,
    monto: c.monto === null ? null : aPesos(aCentavos(c.monto)),
    periodicidad: c.periodicidad,
    mesAnual: c.mesAnual,
    diaPago: c.diaPago,
    activa: c.activa,
    orden: c.orden,
    ...categoriaDelMes(c, mesCat, hoy, montosPorCategoria.get(c.id) ?? []),
    version: c.actualizadoEn.toISOString(),
    }));
  };
  const categorias = categoriasDe(mes, movimientosMesRows);

  // --- Cierre of the previous month (alert 10 on the Tablero) ----------------
  // Only for today's month, the one the Tablero evaluates rule 10 on. The
  // leftover is that month's house «al cierre», computed by the same bridge
  // function Ahorro's figure agrees with; what reached savings counts only the
  // live «Pasar al ahorro» movements of that cierre (their idempotency key
  // names the month they close, wherever their date falls). The 12-month
  // window of `movimientosRows` always contains both months.
  let cierreAnterior: CierreAnterior | null = null;
  if (mes === mesClave(ahora)) {
    const anterior = sumarMeses(mes, -1);
    const rango = rangoMes(anterior);
    const filasAnterior = movimientosRows.filter((m) => m.fecha >= rango.inicio && m.fecha < rango.fin);
    cierreAnterior = {
      mes: anterior,
      sobrante: alCierreCasa(anterior, hoy, { movimientos: filasAnterior.map(aMovimiento), categorias: categoriasDe(anterior, filasAnterior) }),
      pasadoAlAhorro: sumar(movimientosRows.filter((m) => mesDeClaveCierre(m.idempotencyKey) === anterior).map((m) => m.monto)),
    };
  }

  // --- History ---------------------------------------------------------------
  const enHistorial = (fecha: Date) => fecha.getTime() >= inicioHistorial.getTime() && fecha.getTime() < fin.getTime();
  const historial = construirHistorial(mes, {
    cobros: cobrosTodos
      .filter((c) => enHistorial(c.fecha))
      .map(({ cobro, fecha }) => ({ mes: mesClave(fecha), capital: cobro.capital, interes: cobro.interes, total: cobro.total })),
    desembolsos: desembolsosTodos
      .filter((d) => enHistorial(d.fecha))
      .map(({ desembolso, fecha }) => ({ mes: mesClave(fecha), monto: desembolso.monto })),
    movimientos: movimientosRows.map((m) => ({
      mes: mesClave(m.fecha),
      tipo: m.tipo,
      monto: m.monto,
      tipoOrigen: m.cuentaOrigenId ? (tipoCuenta.get(m.cuentaOrigenId) ?? null) : null,
      tipoDestino: m.cuentaDestinoId ? (tipoCuenta.get(m.cuentaDestinoId) ?? null) : null,
    })),
    castigos: castigosRows.filter((c) => enHistorial(c.fecha)).map((c) => ({ mes: mesClave(c.fecha), monto: c.monto })),
  });

  // --- Arqueos, settings, permissions -----------------------------------------
  const arqueos: ArqueoRegistro[] = arqueosRows.map((a) => ({
    id: a.id,
    fecha: a.fecha.toISOString(),
    accionPor: personas.get(a.accionPor) ?? null,
    nota: a.nota,
    detalles: a.detalles.map((d) => ({
      cuentaId: d.cuentaId,
      saldoSistema: aPesos(aCentavos(d.saldoSistema)),
      contado: aPesos(aCentavos(d.contado)),
      diferencia: aPesos(aCentavos(d.diferencia)),
    })),
  }));

  if (!configRow) {
    // The migration inserts it; its absence means the migration did not run.
    throw new Error("Falta la configuración de Casa y Negocio: aplica la migración 20261126120000_casa_negocio_v1.");
  }
  const dinero = (value: Prisma.Decimal | null) => (value === null ? null : aPesos(aCentavos(value)));
  const ordenAviso = (codigo: (typeof CODIGOS_AVISO)[number]) => CODIGOS_AVISO.indexOf(codigo);

  return {
    mes,
    hoy,
    inicioModulo,
    usuario: { id: lector.id, nombre: lector.nombre, capacidades: CAPACIDADES.filter((c) => lector.capacidades.has(c)) },
    cuentas,
    movimientos,
    cobros: cobrosTodos.filter((c) => enMes(c.fecha)).map((c) => c.cobro),
    desembolsos: desembolsosTodos.filter((d) => enMes(d.fecha)).map((d) => d.desembolso),
    sinCuenta: {
      cobros: cobrosTodos.filter((c) => c.cobro.asignable && c.cobro.cuentaId === null).map((c) => c.cobro),
      desembolsos: desembolsosTodos
        .filter((d) => d.desembolso.asignable && d.desembolso.cuentaId === null)
        .map((d) => d.desembolso),
    },
    cuotasPorCobrar,
    tocabaCobrar,
    proyeccion,
    cartera: {
      enLaCalle: sumar(vivos.map((c) => c.saldoCapital)),
      creditosActivos: vivos.length,
      tramos,
      creditos: creditosCartera,
    },
    categorias,
    castigos: castigosRows.map((c) => ({
      id: c.id,
      creditoId: c.creditoId,
      creditoCodigo: c.credito.codigo,
      clienteNombre: c.credito.cliente.nombre,
      monto: aPesos(aCentavos(c.monto)),
      fecha: fechaClave(c.fecha),
      motivo: c.motivo,
      version: c.actualizadoEn.toISOString(),
    })),
    arqueos,
    historial,
    cierreAnterior,
    configuracion: {
      metaAsignacionCasa: dinero(configRow.metaAsignacionCasa),
      metaAhorro: dinero(configRow.metaAhorro),
      cuentaAhorroId: configRow.cuentaAhorroId,
      version: configRow.actualizadoEn.toISOString(),
      reglas: [...reglasRows]
        .sort((a, b) => ordenAviso(a.codigo) - ordenAviso(b.codigo))
        .map((r) => ({ codigo: r.codigo, activa: r.activa, umbral: r.umbral, version: r.actualizadoEn.toISOString() })),
    },
    permisos: personasRows
      ? personasRows.map((p) => ({
          userId: p.id,
          nombre: p.nombre,
          capacidades: CAPACIDADES.filter((c) => p.cnPermisos.some((x) => x.capacidad === c)),
        }))
      : null,
  };
}
