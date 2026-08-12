"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Eye,
  Info,
  Landmark,
  Plus,
  WalletCards,
} from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { overlayRecipes } from "@/design-system/recipes/overlays";
import { formatCurrencyCOP, formatDateCO, formatPercent } from "@/lib/formatters";

import { CreditSearchFilter } from "./credit-search-combobox";
import type { CreditoListadoItem } from "../queries";
import type { FacetedCreditView } from "../faceted-query";
import { CreditFacetHead, OverdueInstallmentCountFilter, ResponsiveCreditFilters } from "./credit-facet-controls";
import type {
  ResumenCreditos,
  SegmentoCreditos,
} from "../portfolio-summary";
import styles from "./creditos-list.module.css";

interface CreditosListProps {
  vista: FacetedCreditView;
  query: string;
  estado: string;
}

export function CreditosList({ vista, query, estado }: CreditosListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(query);
  const [portfolioState, setPortfolioState] = useState(estado);
  const { items: creditos, resumenSegmento } = vista;
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const tableScrollbarRef = useRef<HTMLDivElement | null>(null);
  const tableScrollbarSpacerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const cleanSearch = searchValue.trim();
      if (cleanSearch) params.set("q", cleanSearch); else params.delete("q");
      if (portfolioState) params.set("estado", portfolioState); else params.delete("estado");
      params.delete("page");
      const target = params.size ? `${pathname}?${params.toString()}` : pathname;
      const current = searchParams.size ? `${pathname}?${searchParams.toString()}` : pathname;
      if (target !== current) router.replace(target, { scroll: false });
    }, 250);
    return () => clearTimeout(timeout);
  }, [pathname, portfolioState, router, searchParams, searchValue]);

  useEffect(() => {
    const viewport = tableViewportRef.current;
    const table = tableRef.current;
    const scrollbar = tableScrollbarRef.current;
    const spacer = tableScrollbarSpacerRef.current;
    if (!viewport || !table || !scrollbar || !spacer) return;

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

  function handleCreditoKeyDown(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCredito(id);
    }
  }

  const segment = normalizeSegment(estado);
  const cards = buildMetricCards(resumenSegmento, segment);
  const hasAdvancedFilters = ADVANCED_FILTER_PARAMS.some((key) => Boolean(searchParams.get(key)));
  const hasActiveFilters = Boolean(searchValue.trim() || portfolioState || hasAdvancedFilters);

  return (
    <main className={styles.page}>
      <section className={surfaceRecipes.sectionSpacious}>
        <div className={styles.metricsLayout}>
          <div className={styles.metricsGrid}>
            {cards.map((card, index) => (
              <PortfolioMetric
                key={card.label}
                {...card}
                strong={index === 0}
              />
            ))}
          </div>
          <Link href="/creditos/nuevo" className={`${actionRecipes.primaryLarge} ${styles.primaryAction}`}>
            <Plus className="h-4 w-4" /> Nuevo crédito
          </Link>
        </div>
      </section>

      <section className={`${surfaceRecipes.sectionCompact} ${styles.filterSection}`}>
        <div className={styles.filterLayout}>
          <CreditSearchFilter value={searchValue} onChange={setSearchValue} />
          <label className="block">
            <span className={formRecipes.label}>Estado de la cartera</span>
            <select value={portfolioState} className={formRecipes.control} onChange={(event) => setPortfolioState(event.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="VENCIDA">Con cuotas vencidas</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </label>
          <OverdueInstallmentCountFilter catalogs={vista.facetas} />
          <ResponsiveCreditFilters catalogs={vista.facetas} />
          {hasActiveFilters ? (
            <button type="button" className={actionRecipes.secondary} onClick={() => { setSearchValue(""); setPortfolioState(""); router.replace(pathname, { scroll: false }); }}>
              Limpiar
            </button>
          ) : null}
        </div>
      </section>

      <section className={surfaceRecipes.stickyDataPanel}>
        <div className={surfaceRecipes.dataPanelHeader}>
          <div className="flex items-start gap-2">
            <div>
              <h3 className={dataDisplayRecipes.sectionTitle}>Créditos</h3>
              <p className={styles.supportingText}>
                {vista.totalCoincidencias} resultado(s)
              </p>
            </div>
            <a
              href={buildCreditExportHref(searchParams)}
              className={actionRecipes.entityDetailIcon}
              title="Exportar resultados a Excel"
              aria-label="Exportar resultados a Excel"
            >
              <svg
                viewBox="0 0 32 32"
                className="h-6 w-6"
                aria-hidden="true"
                focusable="false"
              >
                <rect x="11" y="3" width="18" height="26" rx="2.5" fill="#107C41" />
                <path d="M20 8h6M20 13h6M20 18h6M20 23h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M23 6v20" stroke="white" strokeWidth="1.5" opacity="0.9" />
                <path d="M5 6.5 19 4v24L5 25.5v-19Z" fill="#185C37" />
                <path
                  d="m8.2 10 2.65 5.7L8 22h2.75l1.65-4.1 1.7 4.1h2.8l-2.95-6.35L16.6 10h-2.7l-1.45 3.65L10.95 10H8.2Z"
                  fill="white"
                />
              </svg>
            </a>
          </div>
          <div className={styles.summaryGroup}>
            <SummaryPill
              icon={Landmark}
              label="Monto original total"
              value={formatCurrencyCOP(resumenSegmento.montoOriginal)}
              explanation={`Suma del valor inicial de los ${vista.totalCoincidencias} créditos que coinciden con los filtros.`}
            />
            <SummaryPill
              icon={WalletCards}
              label="Capital pendiente total"
              value={formatCurrencyCOP(resumenSegmento.capitalPendiente)}
              explanation={`Saldo vigente de capital calculado sobre todos los resultados del filtro, no solo sobre esta página.`}
            />
            <SummaryPill
              icon={CircleDollarSign}
              label="Interés pendiente total"
              value={formatCurrencyCOP(resumenSegmento.interesPendiente)}
              explanation="Interés programado de cuotas pendientes, atrasadas o en mora de los créditos activos que coinciden con los filtros."
            />
          </div>
        </div>

        <div className={styles.compactList}>
          {creditos.length === 0
            ? <EmptyCredits />
            : creditos.map((credito) => (
                <CreditoCompactCard
                  key={credito.id}
                  credito={credito}
                  onOpen={openCredito}
                  onKeyDown={handleCreditoKeyDown}
                />
              ))}
        </div>

        <div className={styles.desktopTable}>
          <div ref={tableViewportRef} className={styles.tableViewport}>
            <table ref={tableRef} className={styles.creditTable}>
              <colgroup>
                <col className={styles.codeColumn} />
                <col className={styles.clientColumn} />
                <col className={styles.amountColumn} />
                <col className={styles.balanceColumn} />
                <col className={styles.interestColumn} />
                <col className={styles.nextPaymentColumn} />
                <col className={styles.rateColumn} />
                <col className={styles.statusColumn} />
              </colgroup>
              <thead className={styles.tableHeader}>
                <tr>
                  <CreditFacetHead facet="codigo" label="Código" catalogs={vista.facetas} className={styles.stickyCodeHead} />
                  <CreditFacetHead facet="cliente" label="Cliente" catalogs={vista.facetas} />
                  <CreditFacetHead facet="monto" label="Monto original" catalogs={vista.facetas} align="right" />
                  <CreditFacetHead facet="capital" label="Capital pendiente" catalogs={vista.facetas} align="right" />
                  <CreditFacetHead facet="interes" label="Interés pendiente" catalogs={vista.facetas} align="right" />
                  <CreditFacetHead facet="proximaCuota" label="Próxima cuota" catalogs={vista.facetas} />
                  <CreditFacetHead facet="tasa" label="Tasa" catalogs={vista.facetas} align="right" />
                  <TableHead>Estado</TableHead>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {creditos.length === 0 ? (
                  <tr><td colSpan={8}><EmptyCredits /></td></tr>
                ) : creditos.map((credito) => (
                  <tr
                    key={credito.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => openCredito(credito.id)}
                    onKeyDown={(event) => handleCreditoKeyDown(event, credito.id)}
                    className={dataDisplayRecipes.operationalRow}
                  >
                    <TableCell className={styles.stickyCodeCell}>
                      <div className={styles.codeIdentityCell}>
                        <Link href={`/creditos/${credito.id}`} className={dataDisplayRecipes.entityLink} onClick={(event) => event.stopPropagation()}>{credito.codigo}</Link>
                        <Link href={`/creditos/${credito.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del crédito" aria-label={`Ver detalle de ${credito.codigo}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link>
                      </div>
                    </TableCell>
                    <TableCell><div><p className={dataDisplayRecipes.numericCell}>{credito.cliente.nombre}</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">C.C. {credito.cliente.cedula}</p></div></TableCell>
                    <MoneyCell value={credito.monto} />
                    <MoneyCell value={credito.saldoCapital} />
                    <MoneyCell value={credito.interesPendiente} />
                    <TableCell><NextInstallment credito={credito} /></TableCell>
                    <TableCell className={styles.alignRight}>{formatPercent(credito.tasaMensual)}</TableCell>
                    <TableCell><EstadoCreditoBadge credito={credito} /></TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={tableScrollbarRef} className={styles.stickyHorizontalScrollbar} aria-label="Desplazamiento horizontal de la tabla de créditos" tabIndex={0}>
            <div ref={tableScrollbarSpacerRef} className={styles.horizontalScrollbarSpacer} />
          </div>
        </div>

        <Pagination
          page={vista.page}
          totalPages={vista.totalPaginas}
          query={query}
          estado={estado}
        />
      </section>
    </main>
  );
}

function buildMetricCards(summary: ResumenCreditos, segment: SegmentoCreditos): MetricCardData[] {
  if (segment === "CANCELADO") {
    return [
      { label: "Monto original cancelado", value: formatCurrencyCOP(summary.montoOriginal), helper: `${summary.creditosCancelados} crédito(s) cancelado(s)` },
      { label: "Créditos cancelados", value: String(summary.creditosCancelados) },
      { label: "Capital pendiente", value: formatCurrencyCOP(0), helper: "Los créditos cancelados no conservan capital por cobrar" },
      { label: "Última cancelación", value: summary.ultimaCancelacion ? formatDateCO(summary.ultimaCancelacion) : "-" },
    ];
  }

  if (segment === "VENCIDA") {
    return [
      { label: "Capital pendiente vencido", value: formatCurrencyCOP(summary.capitalPendiente), helper: "Saldo vigente de créditos con cuotas vencidas" },
      { label: "Interés pendiente vencido", value: formatCurrencyCOP(summary.interesPendiente), helper: "Interés de cuotas atrasadas, en mora o aún pendientes de esos créditos" },
      { label: "Créditos con cuotas vencidas", value: String(summary.creditosConCuotasVencidas) },
      installmentCard("Cuota vencida más antigua", summary.cuotaVencidaMasAntigua),
    ];
  }

  if (segment === "TODOS") {
    return [
      { label: "Créditos totales", value: String(summary.totalCreditos), helper: `${summary.creditosVigentes} vigente(s) · ${summary.creditosCancelados} cancelado(s)` },
      { label: "Monto original total", value: formatCurrencyCOP(summary.montoOriginal) },
      { label: "Cartera pendiente", value: formatCurrencyCOP(summary.capitalPendiente), helper: `Interés pendiente: ${formatCurrencyCOP(summary.interesPendiente)}` },
      installmentCard("Próxima cuota por cobrar", summary.proximaCuota),
    ];
  }

  return [
    { label: "Capital pendiente activo", value: formatCurrencyCOP(summary.capitalPendiente), helper: `${summary.creditosVigentes} crédito(s) activo(s) · saldo tras último pago` },
    { label: "Interés pendiente activo", value: formatCurrencyCOP(summary.interesPendiente), helper: "Interés de cuotas pendientes" },
    { label: "Créditos activos", value: String(summary.creditosVigentes) },
    installmentCard("Próxima cuota activa", summary.proximaCuota),
  ];
}

function installmentCard(label: string, cuota: ResumenCreditos["proximaCuota"]): MetricCardData {
  return {
    label,
    value: cuota ? formatCurrencyCOP(cuota.valorProgramado) : "-",
    helper: cuota ? `${formatDateCO(cuota.fechaProgramada)} · ${cuota.codigoCredito}` : undefined,
    href: cuota ? `/creditos/${cuota.creditoId}` : undefined,
  };
}

const ADVANCED_FILTER_PARAMS = [
  "codigos", "clientes", "cuotasAtrasadas", "montos", "montoMin", "montoMax",
  "capitales", "capitalMin", "capitalMax", "intereses", "interesMin",
  "interesMax", "proximaFechaDesde", "proximaFechaHasta",
  "proximaValorMin", "proximaValorMax", "sinProximaCuota",
  "tasas", "tasaMin", "tasaMax",
] as const;

function buildCreditExportHref(params: URLSearchParams): string {
  const exportParams = new URLSearchParams(params.toString());
  exportParams.delete("page");
  const query = exportParams.toString();
  return query ? `/api/creditos/exportar-resultados?${query}` : "/api/creditos/exportar-resultados";
}

function normalizeSegment(value: string): SegmentoCreditos {
  if (value === "ACTIVO" || value === "VENCIDA" || value === "CANCELADO") return value;
  return "TODOS";
}

interface MetricCardData { label: string; value: string; helper?: string; href?: string; }
function PortfolioMetric({ label, value, helper, href, strong }: MetricCardData & { strong?: boolean }) {
  const content = <><p className={dataDisplayRecipes.metricCompactLabel}>{label}</p><p className={[dataDisplayRecipes.metricCompactValue, strong ? styles.primaryMetricValue : ""].join(" ")}>{value}</p>{helper ? <p className={dataDisplayRecipes.metricCompactHelper}>{helper}</p> : null}</>;
  const className = [dataDisplayRecipes.metricCompact, strong ? styles.primaryMetricCard : "", href ? styles.metricLink : ""].join(" ");
  return href
    ? <Link href={href} className={className} aria-label={`${label}: ${value}`}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function SummaryPill({ icon: Icon, label, value, explanation }: { icon: typeof CreditCard; label: string; value: string; explanation: string }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <span ref={anchorRef} className={styles.summaryPill} tabIndex={0} aria-describedby={open ? tooltipId : undefined} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <Icon className={styles.summaryPillIcon} /><span><span className={styles.summaryLabel}>{label}</span><strong>{value}</strong></span><Info className={styles.summaryInfoIcon} aria-hidden="true" />
      </span>
      {open ? <TooltipPortal id={tooltipId} anchorRef={anchorRef}>{explanation}</TooltipPortal> : null}
    </>
  );
}

function TooltipPortal({ id, anchorRef, children }: { id: string; anchorRef: React.RefObject<HTMLElement | null>; children: ReactNode }) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useEffect(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    const anchorRect = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ds-space-2")) * 16 || 8, anchorRect.left), window.innerWidth - tooltip.offsetWidth - 8);
    const top = anchorRect.top - tooltip.offsetHeight - 8 >= 8 ? anchorRect.top - tooltip.offsetHeight - 8 : anchorRect.bottom + 8;
    setStyle({ left, top, visibility: "visible" });
  }, [anchorRef]);
  if (typeof document === "undefined") return null;
  return createPortal(<div ref={tooltipRef} id={id} role="tooltip" className={overlayRecipes.tooltip} style={style}>{children}</div>, document.body);
}

function Pagination({ page, totalPages, query, estado }: { page: number; totalPages: number; query: string; estado: string }) {
  if (totalPages <= 1) return null;
  return <nav className={styles.pagination} aria-label="Paginación de créditos">
    <span className={styles.paginationSlot}>{page > 1 ? <Link className={actionRecipes.tertiaryPill} href={buildPageHref(page - 1, query, estado)}>Anterior</Link> : null}</span>
    <span className={styles.paginationText}>Página {page} de {totalPages}</span>
    <span className={`${styles.paginationSlot} ${styles.paginationSlotEnd}`}>{page < totalPages ? <Link className={actionRecipes.tertiaryPill} href={buildPageHref(page + 1, query, estado)}>Siguiente</Link> : null}</span>
  </nav>;
}

function buildPageHref(page: number, query: string, estado: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (estado) params.set("estado", estado);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/creditos?${params.toString()}` : "/creditos";
}

function CreditoCompactCard({ credito, onOpen, onKeyDown }: { credito: CreditoListadoItem; onOpen: (id: string) => void; onKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void }) {
  return <article role="link" tabIndex={0} onClick={() => onOpen(credito.id)} onKeyDown={(event) => onKeyDown(event, credito.id)} className={dataDisplayRecipes.compactRow}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/creditos/${credito.id}`} className={dataDisplayRecipes.entityLink}>{credito.codigo}</Link><EstadoCreditoBadge credito={credito} /></div><p className={styles.clientName}>{credito.cliente.nombre}</p><p className={styles.supportingTextSmall}>C.C. {credito.cliente.cedula}</p></div><Link href={`/creditos/${credito.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del crédito" aria-label={`Ver detalle de ${credito.codigo}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link></div>
    <div className={styles.flatDataGrid}><CompactDatum label="Monto original" value={formatCurrencyCOP(credito.monto)} /><CompactDatum label="Capital pendiente" value={formatCurrencyCOP(credito.saldoCapital)} /><CompactDatum label="Interés pendiente" value={formatCurrencyCOP(credito.interesPendiente)} /><CompactDatum label="Tasa" value={formatPercent(credito.tasaMensual)} /><CompactDatoProximaCuota credito={credito} /></div>
  </article>;
}

function NextInstallment({ credito }: { credito: CreditoListadoItem }) {
  if (!credito.proximaCuota) return <>-</>;
  return <div><p className={dataDisplayRecipes.numericCell}>{formatCurrencyCOP(credito.proximaCuota.valorProgramado)}</p><p className={styles.nextDate}><CalendarDays className="h-3.5 w-3.5" />{formatDateCO(credito.proximaCuota.fechaProgramada)}</p></div>;
}
function CompactDatoProximaCuota({ credito }: { credito: CreditoListadoItem }) { if (!credito.proximaCuota) return <CompactDatum label="Próxima" value="-" />; return <div className={`${dataDisplayRecipes.compactDatum} ${styles.compactDatum}`}><p className={dataDisplayRecipes.compactDatumLabel}>Próxima</p><p className={dataDisplayRecipes.compactDatumValue}>{formatCurrencyCOP(credito.proximaCuota.valorProgramado)}</p><p className={styles.compactDate}><CalendarDays className="h-3 w-3" />{formatDateCO(credito.proximaCuota.fechaProgramada)}</p></div>; }
function CompactDatum({ label, value }: { label: string; value: string }) { return <div className={`${dataDisplayRecipes.compactDatum} ${styles.compactDatum}`}><p className={dataDisplayRecipes.compactDatumLabel}>{label}</p><p className={dataDisplayRecipes.compactDatumValue}>{value}</p></div>; }
function MoneyCell({ value }: { value: number }) { return <TableCell className={`text-right ${dataDisplayRecipes.numericCell} ${styles.atomicValue}`}>{formatCurrencyCOP(value)}</TableCell>; }
function TableCell({ className = "", children }: { className?: string; children: ReactNode }) { return <td className={`${dataDisplayRecipes.tableCell} ${className}`}>{children}</td>; }
function TableHead({ className = "", children }: { className?: string; children: ReactNode }) { return <th className={`${dataDisplayRecipes.tableHead} ${className}`}>{children}</th>; }
function EmptyCredits() { return <div className={styles.emptyState}><p className={styles.emptyTitle}>No hay créditos para los filtros seleccionados.</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Ajusta la búsqueda o usa Limpiar para recuperar el listado.</p></div>; }
function EstadoCreditoBadge({ credito }: { credito: CreditoListadoItem }) { if (credito.estado === "CANCELADO") return <span className={statusRecipes.neutral}>Cancelado</span>; if (credito.tieneCuotasVencidas) return <span className={statusRecipes.warning}>Con cuotas vencidas</span>; return <span className={statusRecipes.success}>Activo</span>; }
