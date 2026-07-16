import { CalendarDays, Landmark, ReceiptText, WalletCards } from "lucide-react";

import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

interface AbonoHistoryItem {
  id: string;
  codigo: string;
  fechaProgramada: Date;
  fechaPago: Date | null;
  valorProgramado: unknown;
  capitalPagado: unknown;
  saldoCapitalPost: unknown | null;
  estado: string;
}

interface AbonosHistoryProps {
  abonos: AbonoHistoryItem[];
}

/**
 * Renders extraordinary principal payments separately from scheduled installments.
 *
 * `saldoCapitalPost` is displayed only when the source event explicitly contains it.
 * A missing historical value is not reconstructed here because doing so without the
 * complete event sequence could create a financially incorrect balance.
 */
export function AbonosHistory({ abonos }: AbonosHistoryProps) {
  if (abonos.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-sm shadow-violet-100/40">
      <div className="border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Abonos extraordinarios a capital
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Historial de movimientos que redujeron el capital por fuera del cronograma de cuotas.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-violet-100 md:hidden">
        {abonos.map((abono) => (
          <article key={abono.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                  {abono.codigo}
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {formatCurrencyCOP(Number(abono.capitalPagado))}
                </p>
              </div>
              <EstadoAbonoBadge estado={abono.estado} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MobileDatum
                icon={CalendarDays}
                label="Fecha efectiva"
                value={formatDateCO(abono.fechaPago ?? abono.fechaProgramada)}
              />
              <MobileDatum
                icon={ReceiptText}
                label="Valor movimiento"
                value={formatCurrencyCOP(Number(abono.valorProgramado))}
              />
              <MobileDatum
                icon={WalletCards}
                label="Saldo posterior"
                value={formatSaldoPosterior(abono.saldoCapitalPost)}
                className="col-span-2"
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[820px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-violet-50/45 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <TableHead>Fecha efectiva</TableHead>
              <TableHead>Código movimiento</TableHead>
              <TableHead className="text-right">Valor movimiento</TableHead>
              <TableHead className="text-right">Capital abonado</TableHead>
              <TableHead className="text-right">Saldo posterior</TableHead>
              <TableHead>Estado</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {abonos.map((abono) => (
              <tr key={abono.id} className="transition hover:bg-violet-50/40">
                <TableCell>{formatDateCO(abono.fechaPago ?? abono.fechaProgramada)}</TableCell>
                <TableCell className="font-semibold text-violet-700">{abono.codigo}</TableCell>
                <TableCell className="text-right font-semibold text-slate-950">
                  {formatCurrencyCOP(Number(abono.valorProgramado))}
                </TableCell>
                <TableCell className="text-right font-black text-slate-950">
                  {formatCurrencyCOP(Number(abono.capitalPagado))}
                </TableCell>
                <TableCell className="text-right font-semibold text-slate-950">
                  {formatSaldoPosterior(abono.saldoCapitalPost)}
                </TableCell>
                <TableCell>
                  <EstadoAbonoBadge estado={abono.estado} />
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatSaldoPosterior(value: unknown | null): string {
  return value === null || value === undefined
    ? "No registrado en origen"
    : formatCurrencyCOP(Number(value));
}

function EstadoAbonoBadge({ estado }: { estado: string }) {
  const pagado = estado === "PAGADO";

  return (
    <span
      className={[
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
        pagado
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      {pagado ? "Aplicado" : estado.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}

interface MobileDatumProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}

function MobileDatum({ icon: Icon, label, value, className = "" }: MobileDatumProps) {
  return (
    <div className={`rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 ${className}`}>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 font-black text-slate-950">{value}</p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return <td className={`whitespace-nowrap px-5 py-3.5 text-slate-700 ${className}`}>{children}</td>;
}

interface TableHeadProps {
  className?: string;
  children: React.ReactNode;
}

function TableHead({ className = "", children }: TableHeadProps) {
  return <th className={`whitespace-nowrap px-5 py-3 text-left font-black ${className}`}>{children}</th>;
}
