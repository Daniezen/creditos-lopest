import { CalendarDays, CheckCircle2, Star } from "lucide-react";

import {
  registrarPagoCuota,
  reversarPagoCuota,
} from "@/features/creditos/pagos/actions";
import { EditPaymentDate } from "@/features/creditos/pagos/components/edit-payment-date";
import { AbonoReversalButton } from "@/features/creditos/abonos/components/abono-reversal-button";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";
import { resolverSaldoMostradoMovimiento } from "@/features/creditos/movement-balance-display";

import styles from "./credit-movements.module.css";

interface CreditMovementEvent {
  id: string;
  codigo: string;
  numeroCuota: number | null;
  tipo: string;
  fechaProgramada: Date;
  fechaPago: Date | null;
  valorProgramado: unknown;
  interesProgramado: unknown;
  capitalPagado: unknown;
  saldoCapitalPost: unknown | null;
  estado: string;
  creadoEn: Date;
  abonoPuedeRevertirse?: boolean;
}

interface CreditMovementsProps {
  creditoId: string;
  montoInicial: number;
  eventos: CreditMovementEvent[];
}

interface DisplayMovement {
  evento: CreditMovementEvent;
  saldoMostrado: number | null;
}


/**
 * Builds the unified operational history used by the legacy Sheets view.
 *
 * Scheduled installments and extraordinary principal payments remain separate
 * domain event types. This function only unifies their presentation. Paid events
 * advance the realized capital balance; pending installments keep their stored
 * projected balance and never mutate the realized running balance.
 */
function buildDisplayMovements(
  eventos: CreditMovementEvent[],
  montoInicial: number,
): DisplayMovement[] {
  const paidEvents = [...eventos]
    .filter((evento) => evento.estado === "PAGADO")
    .sort((left, right) => {
      const leftDate = left.fechaPago ?? left.fechaProgramada;
      const rightDate = right.fechaPago ?? right.fechaProgramada;
      const dateDifference = leftDate.getTime() - rightDate.getTime();

      return dateDifference !== 0
        ? dateDifference
        : left.creadoEn.getTime() - right.creadoEn.getTime();
    });

  // Realized balances must be calculated chronologically, independently from
  // presentation order. Otherwise moving abonos to the end would corrupt their
  // derived historical balances when installments and abonos are interleaved.
  const realizedBalanceByEventId = new Map<string, number>();
  let realizedBalance = montoInicial;

  for (const evento of paidEvents) {
    const storedBalance =
      evento.saldoCapitalPost === null
        ? null
        : Number(evento.saldoCapitalPost);

    realizedBalance =
      storedBalance ??
      Math.max(0, realizedBalance - Number(evento.capitalPagado || 0));
    realizedBalanceByEventId.set(evento.id, realizedBalance);
  }

  const displayEvents = [...eventos].sort((left, right) => {
    const leftIsInstallment = left.tipo === "CUOTA_PROGRAMADA";
    const rightIsInstallment = right.tipo === "CUOTA_PROGRAMADA";

    if (leftIsInstallment && rightIsInstallment) {
      return Number(left.numeroCuota ?? 0) - Number(right.numeroCuota ?? 0);
    }

    if (leftIsInstallment) return -1;
    if (rightIsInstallment) return 1;

    const leftDate = left.fechaPago ?? left.fechaProgramada;
    const rightDate = right.fechaPago ?? right.fechaProgramada;
    const dateDifference = leftDate.getTime() - rightDate.getTime();

    return dateDifference !== 0
      ? dateDifference
      : left.creadoEn.getTime() - right.creadoEn.getTime();
  });

  return displayEvents.map((evento) => ({
    evento,
    saldoMostrado: resolverSaldoMostradoMovimiento({
      estado: evento.estado,
      saldoCapitalPost: evento.saldoCapitalPost,
      saldoRealizado: realizedBalanceByEventId.get(evento.id) ?? null,
    }),
  }));
}

/**
 * Renders scheduled installments and extraordinary principal payments in one
 * chronological history, matching the operational model users already know from
 * Sheets while preserving typed event behavior for mutations.
 */
export function CreditMovements({
  creditoId,
  montoInicial,
  eventos,
}: CreditMovementsProps) {
  const movimientos = buildDisplayMovements(eventos, montoInicial);
  const cuotasCount = eventos.filter(
    (evento) => evento.tipo === "CUOTA_PROGRAMADA",
  ).length;
  const abonosCount = eventos.filter(
    (evento) => evento.tipo === "ABONO_CAPITAL",
  ).length;

  return (
    <section className={surfaceRecipes.dataPanel}>
      <div className={surfaceRecipes.dataPanelHeader}>
        <div>
          <h3 className={dataDisplayRecipes.sectionTitle}>
            Cronograma y movimientos
          </h3>
        </div>

        <div className={styles.counts}>
          <span className={statusRecipes.neutral}>
            <CalendarDays className="h-4 w-4" />
            {cuotasCount} cuota(s)
          </span>
          {abonosCount > 0 ? (
            <span className={statusRecipes.success}>
              <Star className="h-4 w-4" />
              {abonosCount} abono(s)
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.mobileList}>
        {movimientos.map(({ evento, saldoMostrado }) => (
          <MovementCard
            key={evento.id}
            creditoId={creditoId}
            evento={evento}
            saldoMostrado={saldoMostrado}
          />
        ))}
      </div>

      <div className={styles.tableViewport}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <TableHead className="w-[10%]">Movimiento</TableHead>
              <TableHead className="w-[12%]">
                Programada
              </TableHead>
              <TableHead className="w-[12%]">
                Fecha de pago
              </TableHead>
              <TableHead className="w-[12%] text-right">
                Valor
              </TableHead>
              <TableHead className="w-[17%] text-right">
                <span>Intereses</span>
              </TableHead>
              <TableHead className="w-[17%] text-right">
                <span>Saldo capital</span>
              </TableHead>
              <TableHead className="w-[11%]">Estado</TableHead>
              <TableHead className="w-[9%] text-center">¿Pagado?</TableHead>
            </tr>
          </thead>

          <tbody>
            {movimientos.map(({ evento, saldoMostrado }) => (
              <MovementRow
                key={evento.id}
                creditoId={creditoId}
                evento={evento}
                saldoMostrado={saldoMostrado}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MovementRow({
  creditoId,
  evento,
  saldoMostrado,
}: {
  creditoId: string;
  evento: CreditMovementEvent;
  saldoMostrado: number | null;
}) {
  const esAbono = evento.tipo === "ABONO_CAPITAL";
  const estaPagado = evento.estado === "PAGADO";
  const estaAtrasado =
    evento.estado === "ATRASADO" || evento.estado === "MORA";
  const estaCanceladoPorAbono = evento.estado === "CANCELADO_POR_ABONO";
  const action = estaPagado ? reversarPagoCuota : registrarPagoCuota;

  const rowClassName = [
    styles.row,
    esAbono || estaPagado
      ? styles.successRow
      : estaAtrasado
        ? styles.overdueRow
        : estaCanceladoPorAbono
          ? styles.cancelledRow
          : "",
  ].join(" ");

  return (
    <tr className={rowClassName}>
      <TableCell className={dataDisplayRecipes.numericCell}>
        {esAbono ? (
          <span className={styles.abonoLabel}>
            <Star className="h-4 w-4 fill-amber-300 text-amber-500" />
            ABONO
          </span>
        ) : (
          evento.numeroCuota ?? "-"
        )}
      </TableCell>

      <TableCell>{formatDateCO(evento.fechaProgramada)}</TableCell>

      <TableCell>
        {!esAbono && estaPagado && evento.fechaPago ? (
          <EditPaymentDate
            eventoId={evento.id}
            creditoId={creditoId}
            initialDate={evento.fechaPago.toISOString().slice(0, 10)}
            formattedDate={formatDateCO(evento.fechaPago)}
          />
        ) : (
          formatDateCO(evento.fechaPago)
        )}
      </TableCell>

      <TableCell className={`text-right ${dataDisplayRecipes.numericCell}`}>
        {formatCurrencyCOP(Number(evento.valorProgramado))}
      </TableCell>

      <TableCell className="text-right">
        {formatCurrencyCOP(Number(evento.interesProgramado))}
      </TableCell>

      <TableCell className={`text-right ${dataDisplayRecipes.numericCell}`}>
        {saldoMostrado === null ? "-" : formatCurrencyCOP(saldoMostrado)}
      </TableCell>

      <TableCell>
        <EstadoMovimientoBadge estado={evento.estado} esAbono={esAbono} />
      </TableCell>

      <TableCell className="text-center">
        {esAbono ? (
          evento.abonoPuedeRevertirse ? (
            <AbonoReversalButton
              creditoId={creditoId}
              abonoEventoId={evento.id}
            />
          ) : (
            <StaticPaidIndicator />
          )
        ) : (
          <form action={action}>
            <input type="hidden" name="eventoId" value={evento.id} />
            <input type="hidden" name="creditoId" value={creditoId} />
            <button
              type="submit"
              disabled={estaCanceladoPorAbono}
              className="inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={estaPagado ? "Reversar pago" : "Registrar pago"}
            >
              <PaidCheckbox paid={estaPagado} />
            </button>
          </form>
        )}
      </TableCell>
    </tr>
  );
}

function MovementCard({
  creditoId,
  evento,
  saldoMostrado,
}: {
  creditoId: string;
  evento: CreditMovementEvent;
  saldoMostrado: number | null;
}) {
  const esAbono = evento.tipo === "ABONO_CAPITAL";
  const estaPagado = evento.estado === "PAGADO";
  const estaAtrasado =
    evento.estado === "ATRASADO" || evento.estado === "MORA";
  const estaCanceladoPorAbono = evento.estado === "CANCELADO_POR_ABONO";
  const action = estaPagado ? reversarPagoCuota : registrarPagoCuota;

  const cardClassName = [
    styles.card,
    esAbono || estaPagado
      ? styles.successRow
      : estaAtrasado
        ? styles.overdueRow
        : estaCanceladoPorAbono
          ? styles.cancelledRow
          : "",
  ].join(" ");

  return (
    <article className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={[
              styles.cardLabel,
              esAbono ? styles.abonoLabel : "",
            ].join(" ")}
          >
            {esAbono ? (
              <>
                <Star className="h-4 w-4 fill-amber-300 text-amber-500" />
                Abono
              </>
            ) : (
              `Cuota ${evento.numeroCuota ?? "-"}`
            )}
          </p>
          <p className={dataDisplayRecipes.numericCell}>
            {formatCurrencyCOP(Number(evento.valorProgramado))}
          </p>
        </div>

        {esAbono ? (
          <StaticPaidIndicator />
        ) : (
          <form action={action}>
            <input type="hidden" name="eventoId" value={evento.id} />
            <input type="hidden" name="creditoId" value={creditoId} />
            <button
              type="submit"
              disabled={estaCanceladoPorAbono}
              className="inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={estaPagado ? "Reversar pago" : "Registrar pago"}
            >
              <PaidCheckbox paid={estaPagado} />
            </button>
          </form>
        )}
      </div>

      <div className={styles.cardGrid}>
        <CompactField
          label="Fecha programada"
          value={formatDateCO(evento.fechaProgramada)}
        />

        {!esAbono && estaPagado && evento.fechaPago ? (
          <EditPaymentDate
            eventoId={evento.id}
            creditoId={creditoId}
            initialDate={evento.fechaPago.toISOString().slice(0, 10)}
            formattedDate={formatDateCO(evento.fechaPago)}
            compact
          />
        ) : (
          <CompactField
            label="Fecha real"
            value={formatDateCO(evento.fechaPago)}
          />
        )}

        <CompactField
          label="Intereses"
          value={formatCurrencyCOP(Number(evento.interesProgramado))}
        />
        <CompactField
          label="Saldo capital"
          value={
            saldoMostrado === null ? "-" : formatCurrencyCOP(saldoMostrado)
          }
        />
      </div>

      <div className={styles.cardStatus}>
        <EstadoMovimientoBadge estado={evento.estado} esAbono={esAbono} />
      </div>
    </article>
  );
}

function StaticPaidIndicator() {
  return (
    <span
      className={styles.paidIndicator}
      aria-label="Abono aplicado"
      title="Abono aplicado"
    >
      <CheckCircle2 className="h-4 w-4" />
    </span>
  );
}

function PaidCheckbox({ paid }: { paid: boolean }) {
  return (
    <span
      className={[
        styles.checkbox,
        paid ? styles.checkboxPaid : styles.checkboxPending,
      ].join(" ")}
    >
      {paid ? <CheckCircle2 className="h-4 w-4" /> : null}
    </span>
  );
}

function EstadoMovimientoBadge({
  estado,
  esAbono,
}: {
  estado: string;
  esAbono: boolean;
}) {
  if (esAbono && estado === "PAGADO") {
    return (
      <span className={statusRecipes.success}>
        Pagado
      </span>
    );
  }

  if (estado === "PENDIENTE") {
    return (
      <span className={statusRecipes.neutral}>
        Pendiente
      </span>
    );
  }

  if (estado === "PAGADO") {
    return (
      <span className={statusRecipes.success}>
        Pagado
      </span>
    );
  }

  if (estado === "ATRASADO" || estado === "MORA") {
    return (
      <span className={statusRecipes.warning}>
        {formatEnumLabel(estado)}
      </span>
    );
  }

  if (estado === "CANCELADO_POR_ABONO") {
    return (
      <span className={statusRecipes.neutral}>
        Cancelado por abono
      </span>
    );
  }

  return (
    <span className={statusRecipes.neutral}>
      {formatEnumLabel(estado)}
    </span>
  );
}

function CompactField({ label, value }: { label: string; value: string }) {
  return (
    <div className={dataDisplayRecipes.compactDatum}>
      <p className={dataDisplayRecipes.compactDatumLabel}>
        {label}
      </p>
      <p className={dataDisplayRecipes.compactDatumValue}>
        {value}
      </p>
    </div>
  );
}

function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function TableCell({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className={`${dataDisplayRecipes.tableCell} ${styles.tableCell} ${className}`}>
      {children}
    </td>
  );
}

function TableHead({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      className={`${dataDisplayRecipes.tableHead} ${styles.tableHeaderCell} ${className}`}
    >
      {children}
    </th>
  );
}
