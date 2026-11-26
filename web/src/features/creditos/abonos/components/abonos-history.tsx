import { CalendarDays, Landmark, ReceiptText, WalletCards } from "lucide-react";

import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
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
    <section className={`mb-5 ${surfaceRecipes.dataPanel}`}>
      <div className={surfaceRecipes.dataPanelHeader}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-selection)] text-[var(--color-selection-strong)]">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
              Abonos extraordinarios a capital
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Historial de movimientos que redujeron el capital por fuera del cronograma de cuotas.
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border-subtle)] md:hidden">
        {abonos.map((abono) => (
          <article key={abono.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`truncate ${dataDisplayRecipes.eyebrow}`}>
                  {abono.codigo}
                </p>
                <p className="mt-1 text-lg font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
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
        <table className="min-w-[820px] w-full divide-y divide-[var(--color-border-subtle)] text-sm">
          <thead className="bg-[var(--color-surface-subtle)] text-xs font-[var(--font-weight-heading)] text-[var(--color-text-secondary)]">
            <tr>
              <TableHead>Fecha efectiva</TableHead>
              <TableHead>Código movimiento</TableHead>
              <TableHead className="text-right">Valor movimiento</TableHead>
              <TableHead className="text-right">Capital abonado</TableHead>
              <TableHead className="text-right">Saldo posterior</TableHead>
              <TableHead>Estado</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {abonos.map((abono) => (
              <tr key={abono.id} className={dataDisplayRecipes.operationalRow}>
                <TableCell>{formatDateCO(abono.fechaPago ?? abono.fechaProgramada)}</TableCell>
                <TableCell className="font-[var(--font-weight-heading)] text-[var(--color-selection-strong)]">{abono.codigo}</TableCell>
                <TableCell className="text-right font-[var(--font-weight-data)] text-[var(--color-text-primary)]">
                  {formatCurrencyCOP(Number(abono.valorProgramado))}
                </TableCell>
                <TableCell className="text-right font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
                  {formatCurrencyCOP(Number(abono.capitalPagado))}
                </TableCell>
                <TableCell className="text-right font-[var(--font-weight-data)] text-[var(--color-text-primary)]">
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
      className={pagado ? statusRecipes.vigente : statusRecipes.neutral}
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
    <div className={`rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 ${className}`}>
      <p className="flex items-center gap-1 text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return <td className={`${dataDisplayRecipes.tableCell} ${className}`}>{children}</td>;
}

interface TableHeadProps {
  className?: string;
  children: React.ReactNode;
}

function TableHead({ className = "", children }: TableHeadProps) {
  return <th className={`${dataDisplayRecipes.tableHead} ${className}`}>{children}</th>;
}

