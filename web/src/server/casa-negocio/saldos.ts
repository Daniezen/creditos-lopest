/**
 * Account balances of the module.
 *
 *   balance(account, t) = saldoInicial
 *                       + manual movements INTO the account   (fecha in [fechaSaldoInicial, t))
 *                       - manual movements OUT of the account (same window)
 *                       + paid installments/abonos assigned to it (fechaPago in the window)
 *                       - loan disbursements assigned to it       (fechaPrestamo in the window)
 *
 * Every contribution is an "asiento" (signed amount, in integer cents, on a
 * date). Anything dated before the account's `fechaSaldoInicial` is ignored:
 * the opening balance already contains it (spec: what came before 1-dic stays
 * "sin cuenta"). Soft-deleted movements, deleted loans and events that are no
 * longer PAGADO (a reverted payment) never produce an asiento, so a balance is
 * always recalculated from the live rows, never frozen.
 *
 * Balances are module-wide on purpose: an account is a physical place (the
 * cash box, a bank account) and its balance cannot depend on who is looking.
 * Loan-level detail lists, on the other hand, follow the viewer's scope (see
 * `queries.ts`).
 *
 * The calculation is pure; `cargarAsientos` is the only function that reads
 * the database and it takes the client as a parameter (type-only Prisma
 * import), so tests can exercise everything without a connection.
 */
import type { Prisma } from "@prisma/client";

import { aCentavos, aPesos, type Monetario } from "./dinero";

export interface CuentaBase {
  id: string;
  saldoInicial: Monetario;
  fechaSaldoInicial: Date;
}

export interface Asiento {
  cuentaId: string;
  fecha: Date;
  /** Signed: positive enters the account, negative leaves it. */
  centavos: number;
}

export interface ResumenSaldo {
  saldoInicial: number;
  /** Balance at the first instant of the window (`inicio`). */
  saldoInicio: number;
  entradas: number;
  salidas: number;
  /** Balance at the end of the window (`fin`, exclusive). */
  saldoFin: number;
  /** Balance with every asiento up to now. */
  saldoActual: number;
}

// ---------------------------------------------------------------------------
// Asientos from each source
// ---------------------------------------------------------------------------

export interface MovimientoAsentable {
  fecha: Date;
  monto: Monetario;
  cuentaOrigenId: string | null;
  cuentaDestinoId: string | null;
}

/** A manual movement leaves its origin and enters its destination. */
export function asientosDeMovimiento(mov: MovimientoAsentable): Asiento[] {
  const centavos = aCentavos(mov.monto);
  const asientos: Asiento[] = [];
  if (mov.cuentaOrigenId) asientos.push({ cuentaId: mov.cuentaOrigenId, fecha: mov.fecha, centavos: -centavos });
  if (mov.cuentaDestinoId) asientos.push({ cuentaId: mov.cuentaDestinoId, fecha: mov.fecha, centavos });
  return asientos;
}

export interface EventoCobro {
  tipo: "CUOTA_PROGRAMADA" | "ABONO_CAPITAL";
  montoPagado: Monetario;
  capitalPagado: Monetario;
  interesPagado: Monetario;
  capitalProgramado: Monetario;
  interesProgramado: Monetario;
}

/**
 * Capital / interest / cash of a paid event, with the same fallback as the
 * analytics module (`getHistoricoRecaudacion`): installments paid before the
 * split columns were filled have capitalPagado = interesPagado = 0, and for
 * those the scheduled split is the best truth available. An abono is all
 * capital. `total` is the cash that came in: `montoPagado` when recorded,
 * else capital + interest.
 */
export function desgloseCobro(evento: EventoCobro): { capital: number; interes: number; total: number } {
  const capitalPagado = aCentavos(evento.capitalPagado);
  const interesPagado = aCentavos(evento.interesPagado);
  let capital: number;
  let interes: number;
  if (capitalPagado > 0 || interesPagado > 0) {
    capital = capitalPagado;
    interes = interesPagado;
  } else if (evento.tipo === "ABONO_CAPITAL") {
    capital = aCentavos(evento.montoPagado);
    interes = 0;
  } else {
    capital = aCentavos(evento.capitalProgramado);
    interes = aCentavos(evento.interesProgramado);
  }
  const pagado = aCentavos(evento.montoPagado);
  return { capital: aPesos(capital), interes: aPesos(interes), total: aPesos(pagado > 0 ? pagado : capital + interes) };
}

// ---------------------------------------------------------------------------
// Balance arithmetic
// ---------------------------------------------------------------------------

/**
 * Summarises one account over `[inicio, fin)`. Asientos of other accounts are
 * ignored, so the caller can pass the whole list.
 */
export function resumirSaldo(cuenta: CuentaBase, asientos: readonly Asiento[], inicio: Date, fin: Date): ResumenSaldo {
  const base = aCentavos(cuenta.saldoInicial);
  const desde = cuenta.fechaSaldoInicial.getTime();
  let antes = 0;
  let entradas = 0;
  let salidas = 0;
  let despues = 0;
  for (const asiento of asientos) {
    if (asiento.cuentaId !== cuenta.id) continue;
    const t = asiento.fecha.getTime();
    if (t < desde) continue; // already inside saldoInicial
    if (t < inicio.getTime()) antes += asiento.centavos;
    else if (t < fin.getTime()) {
      if (asiento.centavos >= 0) entradas += asiento.centavos;
      else salidas -= asiento.centavos;
    } else despues += asiento.centavos;
  }
  const saldoInicio = base + antes;
  const saldoFin = saldoInicio + entradas - salidas;
  return {
    saldoInicial: aPesos(base),
    saldoInicio: aPesos(saldoInicio),
    entradas: aPesos(entradas),
    salidas: aPesos(salidas),
    saldoFin: aPesos(saldoFin),
    saldoActual: aPesos(saldoFin + despues),
  };
}

/** Current balance of every account (all asientos up to now). */
export function saldosActuales(cuentas: readonly CuentaBase[], asientos: readonly Asiento[]): Map<string, number> {
  const epoch = new Date(0);
  const result = new Map<string, number>();
  for (const cuenta of cuentas) result.set(cuenta.id, resumirSaldo(cuenta, asientos, epoch, epoch).saldoActual);
  return result;
}

// ---------------------------------------------------------------------------
// Loading asientos
// ---------------------------------------------------------------------------

type AsientoReader = Pick<Prisma.TransactionClient, "cnMovimiento" | "cnAsignacionCuenta">;

/**
 * Every asiento of the module, optionally restricted to some accounts. Rows
 * are few (a family books tens per month), so loading them and summing in
 * cents is simpler and safer than a SQL SUM over floats; if volume ever grows
 * this is the one function to turn into a grouped query.
 */
export async function cargarAsientos(db: AsientoReader, cuentaIds?: readonly string[]): Promise<Asiento[]> {
  const enCuentas = cuentaIds ? { in: [...cuentaIds] } : undefined;
  const [movimientos, asignaciones] = await Promise.all([
    db.cnMovimiento.findMany({
      where: {
        eliminadoEn: null,
        ...(enCuentas ? { OR: [{ cuentaOrigenId: enCuentas }, { cuentaDestinoId: enCuentas }] } : {}),
      },
      select: { fecha: true, monto: true, cuentaOrigenId: true, cuentaDestinoId: true },
    }),
    db.cnAsignacionCuenta.findMany({
      where: enCuentas ? { cuentaId: enCuentas } : {},
      select: {
        cuentaId: true,
        eventoFinanciero: {
          select: {
            estado: true,
            fechaPago: true,
            tipo: true,
            montoPagado: true,
            capitalPagado: true,
            interesPagado: true,
            capitalProgramado: true,
            interesProgramado: true,
            credito: { select: { eliminadoEn: true } },
          },
        },
        credito: { select: { monto: true, fechaPrestamo: true, eliminadoEn: true } },
      },
    }),
  ]);

  const asientos: Asiento[] = movimientos.flatMap(asientosDeMovimiento);
  for (const asignacion of asignaciones) {
    const evento = asignacion.eventoFinanciero;
    if (evento && evento.estado === "PAGADO" && evento.fechaPago && !evento.credito.eliminadoEn) {
      const { total } = desgloseCobro(evento);
      asientos.push({ cuentaId: asignacion.cuentaId, fecha: evento.fechaPago, centavos: aCentavos(total) });
    }
    const credito = asignacion.credito;
    if (credito && !credito.eliminadoEn) {
      asientos.push({ cuentaId: asignacion.cuentaId, fecha: credito.fechaPrestamo, centavos: -aCentavos(credito.monto) });
    }
  }
  return asientos;
}
