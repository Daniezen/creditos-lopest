"use client";

import type { ComponentType, KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, Eye, Plus, ShieldCheck, WalletCards } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { formatCurrencyCOP, formatDateCO, formatPercent } from "@/lib/formatters";

import { CreditSearchCombobox } from "./credit-search-combobox";
import type { CreditoListadoItem } from "../queries";
import styles from "./creditos-list.module.css";

interface CreditosListProps {
  creditos: CreditoListadoItem[];
  query: string;
  estado: string;
}

export function CreditosList({ creditos, query, estado }: CreditosListProps) {
  const router = useRouter();
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const tableScrollbarRef = useRef<HTMLDivElement | null>(null);
  const tableScrollbarSpacerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = tableViewportRef.current;
    const table = tableRef.current;
    const scrollbar = tableScrollbarRef.current;
    const spacer = tableScrollbarSpacerRef.current;
    if (!viewport || !table || !scrollbar || !spacer) return;

    // The table itself moves while the Code column compensates by the same
    // distance. This preserves a single horizontal scroll source and keeps the
    // identifying column visible, matching the proven Clients table pattern.
    const activeViewport: HTMLDivElement = viewport;
    const activeTable: HTMLTableElement = table;
    const activeScrollbar: HTMLDivElement = scrollbar;
    const activeSpacer: HTMLDivElement = spacer;
    let syncing = false;

    function updateGeometry() {
      const tableWidth = activeTable.scrollWidth;
      activeSpacer.style.width = `${tableWidth}px`;
      activeScrollbar.hidden = tableWidth <= activeViewport.clientWidth;
      const maximum = Math.max(0, tableWidth - activeViewport.clientWidth);
      if (activeScrollbar.scrollLeft > maximum) activeScrollbar.scrollLeft = maximum;
      activeTable.style.setProperty("--table-scroll-left", `${activeScrollbar.scrollLeft}px`);
    }

    function syncTableFromScrollbar() {
      if (syncing) return;
      syncing = true;
      activeTable.style.setProperty("--table-scroll-left", `${activeScrollbar.scrollLeft}px`);
      requestAnimationFrame(() => { syncing = false; });
    }

    function handleHorizontalWheel(event: WheelEvent) {
      const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0;
      if (!horizontalDelta || activeScrollbar.hidden) return;
      event.preventDefault();
      activeScrollbar.scrollLeft += horizontalDelta;
      syncTableFromScrollbar();
    }

    const resizeObserver = new ResizeObserver(updateGeometry);
    resizeObserver.observe(activeViewport);
    resizeObserver.observe(activeTable);
    activeScrollbar.addEventListener("scroll", syncTableFromScrollbar, { passive: true });
    activeViewport.addEventListener("wheel", handleHorizontalWheel, { passive: false });
    updateGeometry();

    return () => {
      resizeObserver.disconnect();
      activeScrollbar.removeEventListener("scroll", syncTableFromScrollbar);
      activeViewport.removeEventListener("wheel", handleHorizontalWheel);
    };
  }, [creditos.length]);


  function openCredito(id: string) {
    router.push(`/creditos/${id}`);
  }

  function handleCreditoKeyDown(
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCredito(id);
    }
  }
  const creditosActivos = creditos.filter((credito) => credito.estado === "ACTIVO");
  const saldoTotal = creditosActivos.reduce((total, credito) => total + credito.saldoCapital, 0);
  const montoTotal = creditos.reduce((total, credito) => total + credito.monto, 0);
  const proximaCuota = creditos
    .map((credito) => credito.proximaCuota)
    .filter((cuota): cuota is NonNullable<typeof cuota> => cuota !== null)
    .sort((a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime())[0];

  const searchItems = creditos.map((credito) => ({
    id: credito.id,
    codigo: credito.codigo,
    clienteNombre: credito.cliente.nombre,
    clienteCedula: credito.cliente.cedula,
    clienteTelefono: credito.cliente.telefono,
    estado: credito.estado,
  }));

  return (
    <main className={styles.page}>
      <section className={surfaceRecipes.sectionSpacious}>
        <div className={styles.metricsLayout}>
          <div className={styles.metricsGrid}>
            <PortfolioMetric label="Capital pendiente activo" value={formatCurrencyCOP(saldoTotal)} helper={`${creditosActivos.length} crédito(s) activo(s) · saldo tras último pago`} strong />
            <PortfolioMetric label="Créditos activos" value={String(creditosActivos.length)} />
            <PortfolioMetric label="Próxima cuota" value={proximaCuota ? formatCurrencyCOP(proximaCuota.valorProgramado) : "-"} helper={proximaCuota ? formatDateCO(proximaCuota.fechaProgramada) : undefined} />
          </div>
          <Link href="/creditos/nuevo" className={`${actionRecipes.primaryLarge} ${styles.primaryAction}`}>
            <Plus className="h-4 w-4" /> Nuevo crédito
          </Link>
        </div>
      </section>

      <section className={`${surfaceRecipes.sectionCompact} ${styles.filterSection}`}>
        <form action="/creditos" className={styles.filterLayout}>
          <CreditSearchCombobox name="q" initialValue={query} items={searchItems} />
          <label className="block">
            <span className={formRecipes.label}>Estado</span>
            <select name="estado" defaultValue={estado} className={formRecipes.control}>
              <option value="">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </label>
          <div className={styles.filterActions}>
            <button type="submit" className={actionRecipes.primary}>Buscar</button>
            <Link href="/creditos" className={actionRecipes.secondary}>Limpiar</Link>
          </div>
        </form>
      </section>

      <section className={surfaceRecipes.stickyDataPanel}>
        <div className={surfaceRecipes.dataPanelHeader}>
          <div>
            <h3 className={dataDisplayRecipes.sectionTitle}>Créditos</h3>
            <p className={styles.supportingText}>{creditos.length} registro(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SmallPill icon={CreditCard} label={`${creditos.length} créditos`} />
            <SmallPill icon={ShieldCheck} label={`${creditosActivos.length} activos`} />
            <SmallPill icon={WalletCards} label={formatCurrencyCOP(montoTotal)} />
          </div>
        </div>

        <div className={styles.compactList}>
          {creditos.length === 0 ? (
            <EmptyCredits />
          ) : (
            creditos.map((credito) => <CreditoCompactCard key={credito.id} credito={credito} />)
          )}
        </div>
            <div className={styles.desktopTable}>
              <div ref={tableViewportRef} className={styles.tableViewport}>
              <table ref={tableRef} className={styles.creditTable}>
                  <colgroup>
                    <col className={styles.codeColumn} />
                    <col className={styles.clientColumn} />
                    <col className={styles.amountColumn} />
                    <col className={styles.balanceColumn} />
                    <col className={styles.nextPaymentColumn} />
                    <col className={styles.rateColumn} />
                    <col className={styles.statusColumn} />
                  </colgroup>
                <thead className={styles.tableHeader}>
                  <tr>
                    <TableHead className={styles.stickyCodeHead}>Código</TableHead><TableHead>Cliente</TableHead><TableHead className={styles.alignRight}>Monto</TableHead><TableHead className={styles.alignRight}>Capital pendiente</TableHead><TableHead>Próxima cuota</TableHead><TableHead className={styles.alignRight}>Tasa</TableHead><TableHead>Estado</TableHead>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {creditos.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyCredits />
                      </td>
                    </tr>
                  ) : creditos.map((credito) => (
                    <tr
                      key={credito.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openCredito(credito.id)}
                      onKeyDown={(event) => handleCreditoKeyDown(event, credito.id)}
                      className={dataDisplayRecipes.operationalRow}
                    >
                      <TableCell className={styles.stickyCodeCell}><div className={styles.codeIdentityCell}><Link href={`/creditos/${credito.id}`} className={dataDisplayRecipes.entityLink} onClick={(event) => event.stopPropagation()}>{credito.codigo}</Link><Link href={`/creditos/${credito.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del crédito" aria-label={`Ver detalle de ${credito.codigo}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link></div></TableCell>
                      <TableCell><div><p className={dataDisplayRecipes.numericCell}>{credito.cliente.nombre}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">C.C. {credito.cliente.cedula}</p></div></TableCell>
                      <TableCell className={`text-right ${dataDisplayRecipes.numericCell} ${styles.atomicValue}`}>{formatCurrencyCOP(credito.monto)}</TableCell>
                      <TableCell className={`text-right ${dataDisplayRecipes.numericCell} ${styles.atomicValue}`}>{formatCurrencyCOP(credito.saldoCapital)}</TableCell>
                      <TableCell>{credito.proximaCuota ? <div><p className={dataDisplayRecipes.numericCell}>{formatCurrencyCOP(credito.proximaCuota.valorProgramado)}</p><p className={styles.nextDate}><CalendarDays className="h-3.5 w-3.5" />{formatDateCO(credito.proximaCuota.fechaProgramada)}</p></div> : "-"}</TableCell>
                      <TableCell className={styles.alignRight}>{formatPercent(credito.tasaMensual)}</TableCell>
                      <TableCell><EstadoCreditoBadge estado={credito.estado} /></TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div ref={tableScrollbarRef} className={styles.stickyHorizontalScrollbar} aria-label="Desplazamiento horizontal de la tabla de créditos" tabIndex={0}>
                <div ref={tableScrollbarSpacerRef} className={styles.horizontalScrollbarSpacer} />
              </div>
            </div>

      </section>
    </main>
  );
}

function EmptyCredits() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>No hay créditos para los filtros seleccionados.</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Ajusta la búsqueda o usa Limpiar para recuperar el listado.
      </p>
    </div>
  );
}

function CreditoCompactCard({ credito }: { credito: CreditoListadoItem }) {
  const router = useRouter();

  function openCredito(id: string) {
    router.push(`/creditos/${id}`);
  }

  function handleCreditoKeyDown(
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCredito(id);
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => openCredito(credito.id)}
      onKeyDown={(event) => handleCreditoKeyDown(event, credito.id)}
      className={dataDisplayRecipes.compactRow}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/creditos/${credito.id}`} className={dataDisplayRecipes.entityLink}>{credito.codigo}</Link>
            <EstadoCreditoBadge estado={credito.estado} />
          </div>
          <p className={styles.clientName}>{credito.cliente.nombre}</p>
          <p className={styles.supportingTextSmall}>C.C. {credito.cliente.cedula}</p>
        </div>
        <Link href={`/creditos/${credito.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del crédito" aria-label={`Ver detalle de ${credito.codigo}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link>
      </div>
      <div className={styles.flatDataGrid}>
        <CompactDatum label="Monto" value={formatCurrencyCOP(credito.monto)} />
        <CompactDatum label="Capital pendiente" value={formatCurrencyCOP(credito.saldoCapital)} />
        <CompactDatum label="Tasa" value={formatPercent(credito.tasaMensual)} />
        <CompactDatoProximaCuota credito={credito} />
      </div>
    </article>
  );
}

function CompactDatoProximaCuota({ credito }: { credito: CreditoListadoItem }) {
  if (!credito.proximaCuota) return <CompactDatum label="Próxima" value="-" />;
  return <div className={`${dataDisplayRecipes.compactDatum} ${styles.compactDatum}`}><p className={dataDisplayRecipes.compactDatumLabel}>Próxima</p><p className={dataDisplayRecipes.compactDatumValue}>{formatCurrencyCOP(credito.proximaCuota.valorProgramado)}</p><p className={styles.compactDate}><CalendarDays className="h-3 w-3" />{formatDateCO(credito.proximaCuota.fechaProgramada)}</p></div>;
}

function CompactDatum({ label, value }: { label: string; value: string }) {
  return <div className={`${dataDisplayRecipes.compactDatum} ${styles.compactDatum}`}><p className={dataDisplayRecipes.compactDatumLabel}>{label}</p><p className={dataDisplayRecipes.compactDatumValue}>{value}</p></div>;
}

interface PortfolioMetricProps { label: string; value: string; helper?: string; strong?: boolean; }
function PortfolioMetric({ label, value, helper, strong }: PortfolioMetricProps) { return <div className={[dataDisplayRecipes.metricCompact, strong ? styles.primaryMetricCard : ""].join(" ")}><p className={dataDisplayRecipes.metricCompactLabel}>{label}</p><p className={[dataDisplayRecipes.metricCompactValue, strong ? styles.primaryMetricValue : ""].join(" ")}>{value}</p>{helper ? <p className={dataDisplayRecipes.metricCompactHelper}>{helper}</p> : null}</div>; }

interface SmallPillProps { icon: ComponentType<{ className?: string }>; label: string; }
function SmallPill({ icon: Icon, label }: SmallPillProps) { return <span className={styles.summaryPill}><Icon className={styles.summaryPillIcon} />{label}</span>; }

interface TableCellProps { className?: string; children: ReactNode; }
function TableCell({ className = "", children }: TableCellProps) { return <td className={`${dataDisplayRecipes.tableCell} ${className}`}>{children}</td>; }

interface TableHeadProps { className?: string; children: ReactNode; }
function TableHead({ className = "", children }: TableHeadProps) { return <th className={`${dataDisplayRecipes.tableHead} ${className}`}>{children}</th>; }

function EstadoCreditoBadge({ estado }: { estado: string }) {
  if (estado === "ACTIVO") return <span className={statusRecipes.success}>Activo</span>;
  if (estado === "CANCELADO") return <span className={statusRecipes.neutral}>Cancelado</span>;
  return <span className={statusRecipes.neutral}>{estado}</span>;
}
