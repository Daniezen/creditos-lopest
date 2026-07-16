import { CalendarDays, CheckCircle2, Star } from "lucide-react";

import {
  registrarPagoCuota,
  reversarPagoCuota,
} from "@/features/creditos/pagos/actions";
import { EditPaymentDate } from "@/features/creditos/pagos/components/edit-payment-date";
import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

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
    saldoMostrado:
      evento.estado === "PAGADO"
        ? (realizedBalanceByEventId.get(evento.id) ?? null)
        : evento.saldoCapitalPost === null
          ? null
          : Number(evento.saldoCapitalPost),
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
    <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-950">
            Cronograma y movimientos
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-sm font-bold text-violet-700 shadow-sm">
            <CalendarDays className="h-4 w-4" />
            {cuotasCount} cuota(s)
          </span>
          {abonosCount > 0 ? (
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 shadow-sm">
              <Star className="h-4 w-4" />
              {abonosCount} abono(s)
            </span>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-violet-100 md:hidden">
        {movimientos.map(({ evento, saldoMostrado }) => (
          <MovementCard
            key={evento.id}
            creditoId={creditoId}
            evento={evento}
            saldoMostrado={saldoMostrado}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
          <thead className="bg-violet-50/60 text-xs uppercase tracking-wide text-slate-600">
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
                <span className="font-black text-blue-700">Intereses</span>
              </TableHead>
              <TableHead className="w-[17%] text-right">
                <span className="font-black text-green-700">Saldo capital</span>
              </TableHead>
              <TableHead className="w-[11%]">Estado</TableHead>
              <TableHead className="w-[9%] text-center">¿Pagado?</TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
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
    "transition",
    esAbono
      ? "bg-emerald-50/70 hover:bg-emerald-50"
      : estaPagado
        ? "bg-emerald-50/80 hover:bg-emerald-50"
        : estaAtrasado
          ? "bg-red-50/80 hover:bg-red-50"
          : estaCanceladoPorAbono
            ? "bg-slate-50 text-slate-500"
            : "hover:bg-violet-50/40",
  ].join(" ");

  return (
    <tr className={rowClassName}>
      <TableCell className="font-semibold text-slate-950">
        {esAbono ? (
          <span className="inline-flex items-center gap-1.5 font-black text-emerald-800">
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

      <TableCell className="text-right font-bold text-slate-950">
        {formatCurrencyCOP(Number(evento.valorProgramado))}
      </TableCell>

      <TableCell className="text-right">
        {formatCurrencyCOP(Number(evento.interesProgramado))}
      </TableCell>

      <TableCell className="text-right font-semibold text-slate-950">
        {saldoMostrado === null ? "-" : formatCurrencyCOP(saldoMostrado)}
      </TableCell>

      <TableCell>
        <EstadoMovimientoBadge estado={evento.estado} esAbono={esAbono} />
      </TableCell>

      <TableCell className="text-center">
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
    "p-4 transition",
    esAbono
      ? "bg-emerald-50/70"
      : estaPagado
        ? "bg-emerald-50/80"
        : estaAtrasado
          ? "bg-red-50/80"
          : estaCanceladoPorAbono
            ? "bg-slate-50 text-slate-500"
            : "bg-white",
  ].join(" ");

  return (
    <article className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={[
              "flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.18em]",
              esAbono ? "text-emerald-800" : "text-violet-700",
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
          <p className="mt-1 text-sm font-semibold text-slate-950">
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

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
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

      <div className="mt-3">
        <EstadoMovimientoBadge estado={evento.estado} esAbono={esAbono} />
      </div>
    </article>
  );
}

function StaticPaidIndicator() {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded border-2 border-emerald-600 bg-emerald-600 text-white"
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
        "flex h-6 w-6 items-center justify-center rounded border-2 transition",
        paid
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-red-400 bg-white text-white",
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
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
        Pagado
      </span>
    );
  }

  if (estado === "PENDIENTE") {
    return (
      <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
        Pendiente
      </span>
    );
  }

  if (estado === "PAGADO") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Pagado
      </span>
    );
  }

  if (estado === "ATRASADO" || estado === "MORA") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        {formatEnumLabel(estado)}
      </span>
    );
  }

  if (estado === "CANCELADO_POR_ABONO") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Cancelado por abono
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {formatEnumLabel(estado)}
    </span>
  );
}

function CompactField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white/80 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap font-semibold text-slate-900">
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
    <td className={`whitespace-nowrap px-2 py-3 text-slate-700 xl:px-3 ${className}`}>
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
      className={`whitespace-normal px-2 py-3 text-left xl:px-3 align-middle font-semibold leading-tight ${className}`}
    >
      {children}
    </th>
  );
}
