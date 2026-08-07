"use client";

import type { ComponentType, CSSProperties, KeyboardEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  SlidersHorizontal,
  Plus,
  Search,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { formatCurrencyCOP } from "@/lib/formatters";

import type { ClienteListadoItem } from "../queries";
import styles from "./clientes-list.module.css";

interface ClientesListProps {
  clientes: ClienteListadoItem[];
  query: string;
  estadoDocumentos: string;
}

export function ClientesList({ clientes, query, estadoDocumentos }: ClientesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(query);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [openColumnFilter, setOpenColumnFilter] = useState<string | null>(null);
  const filtersRef = useRef<HTMLTableSectionElement | null>(null);
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const tableScrollbarRef = useRef<HTMLDivElement | null>(null);
  const tableScrollbarSpacerRef = useRef<HTMLDivElement | null>(null);
  const [portfolioState, setPortfolioState] = useState(() => searchParams.get("cartera") ?? "");
  const [selectedIds, setSelectedIds] = useState(() => parseList(searchParams.get("cedulas")));
  const [selectedPhones, setSelectedPhones] = useState(() => parseList(searchParams.get("telefonos")));
  const [selectedCompanies, setSelectedCompanies] = useState(() => parseList(searchParams.get("empresas")));
  const [selectedReferrers, setSelectedReferrers] = useState(() => parseList(searchParams.get("recomendadosPor")));
  const [selectedCredits, setSelectedCredits] = useState(() => parseNumberList(searchParams.get("creditos")));
  const [selectedDocuments, setSelectedDocuments] = useState(() => {
    const currentValues = parseList(searchParams.get("documentos"));
    return currentValues.length > 0 || !estadoDocumentos
      ? currentValues
      : [estadoDocumentos];
  });
  const [selectedCapital, setSelectedCapital] = useState(() => parseNumberList(searchParams.get("capitalValores")));
  const [selectedInterest, setSelectedInterest] = useState(() => parseNumberList(searchParams.get("interesValores")));
  const [capitalMin, setCapitalMin] = useState(() => searchParams.get("capitalMin") ?? "");
  const [capitalMax, setCapitalMax] = useState(() => searchParams.get("capitalMax") ?? "");
  const [interestMin, setInterestMin] = useState(() => searchParams.get("interesMin") ?? "");
  const [interestMax, setInterestMax] = useState(() => searchParams.get("interesMax") ?? "");
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedSearch = searchValue.trim().toLocaleLowerCase("es-CO");

  const filterContext: ClientFilterContext = {
    normalizedSearch,
    portfolioState,
    selectedIds,
    selectedPhones,
    selectedCompanies,
    selectedReferrers,
    selectedCredits,
    selectedDocuments,
    selectedCapital,
    selectedInterest,
    capitalMin,
    capitalMax,
    interestMin,
    interestMax,
  };

  const filteredClients = clientes.filter((client) =>
    matchesClientFilters(client, filterContext),
  );

  // Every facet applies all active criteria except its own. This makes option
  // catalogs narrow with the current result set while preserving the ability
  // to broaden or clear the facet currently being edited.
  const facetClients = (omittedFacet: ClientFacet) =>
    clientes.filter((client) => matchesClientFilters(client, filterContext, omittedFacet));

  const idOptions = uniqueStrings([...facetClients("cedula").map((client) => client.cedula), ...selectedIds]);
  const phoneOptions = uniqueStrings([...facetClients("telefono").map((client) => client.telefono ?? "Sin teléfono"), ...selectedPhones]);
  const companyOptions = uniqueStrings([...facetClients("empresa").map((client) => client.empresa ?? "Sin empresa"), ...selectedCompanies]);
  const referrerOptions = uniqueStrings([...facetClients("recomendadoPor").map((client) => toReferrerFilterValue(client.recomienda)), ...selectedReferrers]);
  const creditOptions = uniqueNumbers([...facetClients("creditos").map((client) => client.creditosActivos), ...selectedCredits]);
  const documentOptions = uniqueStrings([...facetClients("documentos").map((client) => client.estadoDocumentos), ...selectedDocuments]);
  const capitalOptions = uniqueNumbers([...facetClients("capital").map((client) => client.saldoTotal), ...selectedCapital]);
  const interestOptions = uniqueNumbers([...facetClients("interes").map((client) => client.interesPendienteTotal), ...selectedInterest]);

  const suggestions = useMemo(() => filteredClients.slice(0, 10), [filteredClients]);
  const profilesPending = filteredClients.filter((client) => client.perfilIncompleto);
  const documentsPending = filteredClients.filter((client) => client.estadoDocumentos === "FALTAN_DOCUMENTOS");
  const activeCredits = filteredClients.reduce((total, client) => total + client.creditosActivos, 0);
  const clientsWithActiveCredit = filteredClients.filter((client) => client.creditosActivos > 0).length;
  const advancedFilterCount = [selectedIds.length, selectedPhones.length, selectedCompanies.length, selectedReferrers.length, selectedCredits.length, selectedDocuments.length, selectedCapital.length, selectedInterest.length, capitalMin, capitalMax, interestMin, interestMax].filter(Boolean).length;
  const activeFilterCount = [searchValue.trim(), portfolioState, advancedFilterCount].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      syncParam(params, "q", searchValue);
      syncParam(params, "cartera", portfolioState);
      syncList(params, "cedulas", selectedIds);
      syncList(params, "telefonos", selectedPhones);
      syncList(params, "empresas", selectedCompanies);
      syncList(params, "recomendadosPor", selectedReferrers);
      syncNumberList(params, "creditos", selectedCredits);
      syncList(params, "documentos", selectedDocuments);
      syncNumberList(params, "capitalValores", selectedCapital);
      syncNumberList(params, "interesValores", selectedInterest);
      syncParam(params, "capitalMin", capitalMin);
      syncParam(params, "capitalMax", capitalMax);
      syncParam(params, "interesMin", interestMin);
      syncParam(params, "interesMax", interestMax);
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timeout);
  }, [capitalMax, capitalMin, interestMax, interestMin, pathname, portfolioState, router, searchValue, selectedCapital, selectedCompanies, selectedCredits, selectedDocuments, selectedIds, selectedInterest, selectedPhones, selectedReferrers]);

  useEffect(() => {
    function closeColumnFilter(event: MouseEvent) {
      const target = event.target as Element;
      const insideHeader = filtersRef.current?.contains(target) ?? false;
      const insidePortal = Boolean(target.closest("[data-client-filter-portal]"));
      if (!insideHeader && !insidePortal) setOpenColumnFilter(null);
    }
    function closeColumnFilterWithKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpenColumnFilter(null);
    }
    document.addEventListener("mousedown", closeColumnFilter);
    window.addEventListener("keydown", closeColumnFilterWithKeyboard);
    return () => {
      document.removeEventListener("mousedown", closeColumnFilter);
      window.removeEventListener("keydown", closeColumnFilterWithKeyboard);
    };
  }, []);

  useEffect(() => {
    if (!mobileFiltersOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeResponsiveFilters(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setMobileFiltersOpen(false);
    }

    window.addEventListener("keydown", closeResponsiveFilters);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeResponsiveFilters);
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    const viewport = tableViewportRef.current;
    const table = tableRef.current;
    const scrollbar = tableScrollbarRef.current;
    const spacer = tableScrollbarSpacerRef.current;
    if (!viewport || !table || !scrollbar || !spacer) return;

    // Stable non-null aliases are required because TypeScript does not carry
    // ref narrowing into callbacks that may execute after the current frame.
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
  }, [filteredClients.length]);

  function clearAdvancedFilters() {
    setSelectedIds([]);
    setSelectedPhones([]);
    setSelectedCompanies([]);
    setSelectedReferrers([]);
    setSelectedCredits([]);
    setSelectedDocuments([]);
    setSelectedCapital([]);
    setSelectedInterest([]);
    setCapitalMin("");
    setCapitalMax("");
    setInterestMin("");
    setInterestMax("");
  }

  function clearFilters() {
    setSearchValue("");
    setPortfolioState("");
    setSelectedIds([]);
    setSelectedPhones([]);
    setSelectedCompanies([]);
    setSelectedReferrers([]);
    setSelectedCredits([]);
    setSelectedDocuments([]);
    setSelectedCapital([]);
    setSelectedInterest([]);
    setCapitalMin("");
    setCapitalMax("");
    setInterestMin("");
    setInterestMax("");
    setOpenColumnFilter(null);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    router.replace(pathname, { scroll: false });
  }


  function openClient(id: string) {
    router.push(`/clientes/${id}`);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openClient(id);
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      event.preventDefault();
      openClient(suggestions[activeSuggestion].id);
    }
  }

  function handleSearchBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }, 150);
  }

  function selectSuggestion(id: string) {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    openClient(id);
  }

  return (
    <main className={styles.page}>
      <section className={surfaceRecipes.sectionSpacious}>
        <div className={styles.metricsLayout}>
          <div className={styles.metricsGrid}>
            <PortfolioMetric icon={Users} label="Clientes" value={String(filteredClients.length)} />
            <PortfolioMetric icon={AlertTriangle} label="Perfiles pendientes" value={String(profilesPending.length)} />
            <PortfolioMetric icon={FileText} label="Documentos pendientes" value={String(documentsPending.length)} />
            <PortfolioMetric icon={WalletCards} label="Clientes con crédito activo" value={String(clientsWithActiveCredit)} helper={`${activeCredits} crédito(s) activo(s)`} />
          </div>
          <div className={styles.primaryActions}>
            <Link href="/clientes/nuevo" className={actionRecipes.primaryLarge}><Plus className="h-4 w-4" />Nuevo cliente</Link>
          </div>
        </div>
      </section>

      <section className={`${surfaceRecipes.sectionCompact} ${styles.filterSection}`}>
        <div className={styles.filterLayout}>
          <div className={styles.searchWrapper}>
            <span className={formRecipes.labelWithIcon}><Search className="h-4 w-4 text-[var(--color-action-primary)]" />Buscar cliente por nombre</span>
            <div className="relative">
              <Search className={styles.searchIcon} aria-hidden="true" />
              <input
                value={searchValue}
                placeholder="Nombre del cliente"
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestionsOpen}
                aria-controls="client-search-suggestions"
                aria-activedescendant={activeSuggestion >= 0 ? `client-suggestion-${suggestions[activeSuggestion]?.id}` : undefined}
                className={formRecipes.searchControl}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  setSuggestionsOpen(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
              />
              {searchValue ? (
                <button type="button" className={styles.clearSearch} onMouseDown={(event) => event.preventDefault()} onClick={() => setSearchValue("")} aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></button>
              ) : null}

              {suggestionsOpen ? (
                <div id="client-search-suggestions" role="listbox" className={formRecipes.comboboxPanel}>
                  {suggestions.length > 0 ? (
                    <ul className="py-2">
                      {suggestions.map((client, index) => (
                        <li key={client.id}>
                          <button
                            id={`client-suggestion-${client.id}`}
                            type="button"
                            role="option"
                            aria-selected={activeSuggestion === index}
                            className={[formRecipes.comboboxOption, activeSuggestion === index ? formRecipes.comboboxOptionActive : ""].join(" ")}
                            onMouseDown={(event) => { event.preventDefault(); selectSuggestion(client.id); }}
                          >
                            <div className="flex gap-3">
                              <div className={dataDisplayRecipes.entityAvatar}><UserRound className="h-4 w-4" /></div>
                              <div className="min-w-0">
                                <p className={dataDisplayRecipes.suggestionTitle}>{client.nombre}</p>
                                <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">C.C. {client.cedula}{client.telefono ? ` · Tel. ${client.telefono}` : ""}{client.empresa ? ` · ${client.empresa}` : ""}</p>
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-5 text-sm text-[var(--color-text-secondary)]">No hay clientes para ese criterio.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.filterControls}>
            <label className={styles.portfolioFilter}><span className={formRecipes.label}>Estado de cartera</span><select value={portfolioState} className={formRecipes.control} onChange={(event) => setPortfolioState(event.target.value)}><option value="">Todos</option><option value="AL_DIA">Al día</option><option value="VENCIDA">Con cuotas vencidas</option><option value="SIN_CREDITOS_ACTIVOS">Sin créditos activos</option></select></label>
            <button type="button" className={[actionRecipes.secondary, styles.mobileFilterButton].join(" ")} onClick={() => setMobileFiltersOpen(true)} aria-expanded={mobileFiltersOpen} aria-controls="client-responsive-filters">
              <Filter className="h-4 w-4" />
              Filtros{advancedFilterCount ? ` (${advancedFilterCount})` : ""}
            </button>
            {hasActiveFilters ? <button type="button" className={actionRecipes.secondary} onClick={clearFilters}>Limpiar</button> : null}
          </div>
        </div>
      </section>

      {mobileFiltersOpen ? (
        <div className={styles.responsiveFilterLayer}>
          <button type="button" className={styles.responsiveFilterBackdrop} aria-label="Cerrar filtros" onClick={() => setMobileFiltersOpen(false)} />
          <section id="client-responsive-filters" className={[surfaceRecipes.filterOverlayPanel, styles.responsiveFilterPanel].join(" ")} role="dialog" aria-modal="true" aria-labelledby="client-responsive-filters-title">
            <header className={styles.responsiveFilterHeader}>
              <div><h2 id="client-responsive-filters-title">Filtros</h2><p>{advancedFilterCount ? `${advancedFilterCount} criterio(s) activo(s)` : "Selecciona criterios adicionales"}</p></div>
              <button type="button" className={actionRecipes.entityDetailIcon} onClick={() => setMobileFiltersOpen(false)} aria-label="Cerrar filtros"><X className="h-4 w-4" /></button>
            </header>
            <div className={styles.responsiveFilterBody}>
              <ResponsiveFilters idOptions={idOptions} phoneOptions={phoneOptions} companyOptions={companyOptions} referrerOptions={referrerOptions} creditOptions={creditOptions} documentOptions={documentOptions} selectedIds={selectedIds} setSelectedIds={setSelectedIds} selectedPhones={selectedPhones} setSelectedPhones={setSelectedPhones} selectedCompanies={selectedCompanies} setSelectedCompanies={setSelectedCompanies} selectedReferrers={selectedReferrers} setSelectedReferrers={setSelectedReferrers} selectedCredits={selectedCredits} setSelectedCredits={setSelectedCredits} selectedDocuments={selectedDocuments} setSelectedDocuments={setSelectedDocuments} capitalMin={capitalMin} setCapitalMin={setCapitalMin} capitalMax={capitalMax} setCapitalMax={setCapitalMax} interestMin={interestMin} setInterestMin={setInterestMin} interestMax={interestMax} setInterestMax={setInterestMax} />
            </div>
            <footer className={styles.responsiveFilterFooter}>
              {advancedFilterCount ? <button type="button" className={actionRecipes.secondary} onClick={clearAdvancedFilters}>Limpiar filtros</button> : <span />}
              <button type="button" className={actionRecipes.primary} onClick={() => setMobileFiltersOpen(false)}>Cerrar</button>
            </footer>
          </section>
        </div>
      ) : null}

      <section className={surfaceRecipes.stickyDataPanel}>
        <div className={surfaceRecipes.dataPanelHeader}>
          <div><h3 className={dataDisplayRecipes.sectionTitle}>Clientes</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{filteredClients.length} registro(s)</p></div>
        </div>

        <div className={styles.compactList}>{filteredClients.length ? filteredClients.map((client) => <ClientCompactRow key={client.id} client={client} onOpen={openClient} onKeyDown={handleRowKeyDown} />) : <EmptyFilters />}</div>
        <div className={styles.desktopTable}>
          <div ref={tableViewportRef} className={styles.tableViewport}>
              <table ref={tableRef} className={styles.clientTable}>
                <colgroup>
                  <col className={styles.clientColumn} />
                  <col className={styles.idColumn} />
                  <col className={styles.phoneColumn} />
                  <col className={styles.companyColumn} />
                  <col className={styles.referrerColumn} />
                  <col className={styles.creditsColumn} />
                  <col className={styles.capitalColumn} />
                  <col className={styles.interestColumn} />
                  <col className={styles.documentsColumn} />
                </colgroup>
                <thead ref={filtersRef} className="bg-[var(--color-surface-subtle)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]"><tr><TableHead className={styles.stickyClientHead}>Cliente</TableHead><ExcelHead label="Cédula" name="cedula" values={idOptions} selected={selectedIds} setSelected={setSelectedIds} open={openColumnFilter} setOpen={setOpenColumnFilter} /><ExcelHead label="Teléfono" name="telefono" values={phoneOptions} selected={selectedPhones} setSelected={setSelectedPhones} open={openColumnFilter} setOpen={setOpenColumnFilter} /><ExcelHead label="Empresa" name="empresa" values={companyOptions} selected={selectedCompanies} setSelected={setSelectedCompanies} open={openColumnFilter} setOpen={setOpenColumnFilter} /><ExcelHead label={<>Recomendado<br />por</>} name="recomendadoPor" values={referrerOptions} selected={selectedReferrers} setSelected={setSelectedReferrers} open={openColumnFilter} setOpen={setOpenColumnFilter} format={formatReferrerValue} /><ExcelHead label={<>Créditos<br />activos</>} name="creditos" values={creditOptions} selected={selectedCredits} setSelected={setSelectedCredits} open={openColumnFilter} setOpen={setOpenColumnFilter} /><HybridHead label={<>Capital<br />pendiente</>} name="capital" values={capitalOptions} selected={selectedCapital} setSelected={setSelectedCapital} min={capitalMin} setMin={setCapitalMin} max={capitalMax} setMax={setCapitalMax} open={openColumnFilter} setOpen={setOpenColumnFilter} /><HybridHead label={<>Interés<br />pendiente</>} name="interes" values={interestOptions} selected={selectedInterest} setSelected={setSelectedInterest} min={interestMin} setMin={setInterestMin} max={interestMax} setMax={setInterestMax} open={openColumnFilter} setOpen={setOpenColumnFilter} /><ExcelHead label="Documentos" name="documentos" values={documentOptions} selected={selectedDocuments} setSelected={setSelectedDocuments} open={openColumnFilter} setOpen={setOpenColumnFilter} format={formatDocumentValue} align="right" /></tr></thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredClients.length === 0 ? <tr><td colSpan={9}><EmptyFilters /></td></tr> : filteredClients.map((client) => (
                    <tr key={client.id} role="link" tabIndex={0} onClick={() => openClient(client.id)} onKeyDown={(event) => handleRowKeyDown(event, client.id)} className={dataDisplayRecipes.operationalRow}>
                      <TableCell className={styles.stickyClientCell}><div className={styles.clientIdentityCell}><div className="flex min-w-0 items-start gap-3"><div className={dataDisplayRecipes.entityAvatar}><UserRound className="h-4 w-4" /></div><div className="min-w-0"><Link href={`/clientes/${client.id}`} className={dataDisplayRecipes.entityLink} onClick={(event) => event.stopPropagation()}>{client.nombre}</Link>{client.perfilIncompleto ? <p className={`mt-1 ${dataDisplayRecipes.supportingWarning}`}>Perfil pendiente</p> : null}</div></div><Link href={`/clientes/${client.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del cliente" aria-label={`Ver detalle de ${client.nombre}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link></div></TableCell>
                      <TableCell className={styles.atomicValue}>{client.cedula}</TableCell><TableCell className={styles.atomicValue}>{client.telefono || "-"}</TableCell><TableCell>{client.empresa || "-"}</TableCell><TableCell>{formatReferrerDisplay(client.recomienda)}</TableCell><TableCell className={`${styles.atomicValue} text-center tabular-nums`}>{client.creditosActivos}</TableCell>
                      <TableCell className={`${styles.atomicValue} ${dataDisplayRecipes.numericCell} text-right`}>{formatCurrencyCOP(client.saldoTotal)}</TableCell>
                      <TableCell className={`${styles.atomicValue} ${dataDisplayRecipes.numericCell} text-right`}>{formatCurrencyCOP(client.interesPendienteTotal)}</TableCell>
                      <TableCell><DocumentStatus status={client.estadoDocumentos} /></TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
          <div ref={tableScrollbarRef} className={styles.stickyHorizontalScrollbar} aria-label="Desplazamiento horizontal de la tabla" tabIndex={0}>
            <div ref={tableScrollbarSpacerRef} className={styles.horizontalScrollbarSpacer} />
          </div>
        </div>
      </section>
    </main>
  );
}

interface CompactRowProps {
  client: ClienteListadoItem;
  onOpen: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void;
}

function ClientCompactRow({ client, onOpen, onKeyDown }: CompactRowProps) {
  return (
    <article role="link" tabIndex={0} onClick={() => onOpen(client.id)} onKeyDown={(event) => onKeyDown(event, client.id)} className={dataDisplayRecipes.compactRow}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><div className={dataDisplayRecipes.entityAvatar}><UserRound className="h-4 w-4" /></div><div className="min-w-0"><Link href={`/clientes/${client.id}`} className={dataDisplayRecipes.compactEntityLink}>{client.nombre}</Link><p className="text-xs text-[var(--color-text-secondary)]">C.C. {client.cedula}</p>{client.perfilIncompleto ? <p className={`mt-1 ${dataDisplayRecipes.supportingWarning}`}>Perfil pendiente</p> : null}</div></div>
        <Link href={`/clientes/${client.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del cliente" aria-label={`Ver detalle de ${client.nombre}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link>
      </div>
      <dl className={styles.flatDataGrid}><FlatDatum label="Teléfono" value={client.telefono || "-"} /><FlatDatum label="Empresa" value={client.empresa || "-"} /><FlatDatum label="Recomendado por" value={formatReferrerDisplay(client.recomienda)} /><FlatDatum label="Créditos" value={String(client.creditosActivos)} /><FlatDatum label="Capital pendiente" value={formatCurrencyCOP(client.saldoTotal)} /><FlatDatum label="Interés pendiente" value={formatCurrencyCOP(client.interesPendienteTotal)} /><div className="min-w-0"><dt className={dataDisplayRecipes.flatDatumLabel}>Documentos</dt><dd className={styles.compactStatus}><DocumentStatus status={client.estadoDocumentos} /></dd></div></dl>
    </article>
  );
}

function FlatDatum({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className={dataDisplayRecipes.flatDatumLabel}>{label}</dt><dd className={dataDisplayRecipes.flatDatumValue}>{value}</dd></div>; }

interface PortfolioMetricProps { icon: ComponentType<{ className?: string }>; label: string; value: string; helper?: string; }
function PortfolioMetric({ icon: Icon, label, value, helper }: PortfolioMetricProps) { return <div className={dataDisplayRecipes.metricCompact}><p className={dataDisplayRecipes.metricCompactLabel}><Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)]" />{label}</p><p className={dataDisplayRecipes.metricCompactValue}>{value}</p>{helper ? <p className={dataDisplayRecipes.metricCompactHelper}>{helper}</p> : null}</div>; }

interface TableCellProps { className?: string; children: ReactNode; }
function TableCell({ className = "", children }: TableCellProps) { return <td className={`${dataDisplayRecipes.tableCell} ${className}`}>{children}</td>; }
interface TableHeadProps { className?: string; children: ReactNode; }
function TableHead({ className = "", children }: TableHeadProps) { return <th className={`${dataDisplayRecipes.tableHead} ${className}`}>{children}</th>; }

type SetValues<T> = (values: T[]) => void;

function ExcelHead<T extends string | number>({ label, name, values, selected, setSelected, open, setOpen, format, align }: { label: ReactNode; name: string; values: T[]; selected: T[]; setSelected: SetValues<T>; open: string | null; setOpen: (value: string | null) => void; format?: (value: T) => string; align?: "right" }) {
  const visible = open === name;
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return <th className={[dataDisplayRecipes.tableHead, styles.filterHead, align ? styles.filterHeadRight : ""].join(" ")}><button ref={anchorRef} type="button" className={[styles.filterHeadButton, selected.length ? styles.filterHeadActive : ""].join(" ")} onClick={() => setOpen(visible ? null : name)} aria-expanded={visible}><span>{label}</span><SlidersHorizontal className="h-3.5 w-3.5" /></button>{visible ? <ColumnFilterPortal anchorRef={anchorRef} align={align}><ValueChecklist values={values} selected={selected} setSelected={setSelected} format={format} /></ColumnFilterPortal> : null}</th>;
}

function HybridHead({ label, name, values, selected, setSelected, min, setMin, max, setMax, open, setOpen }: { label: ReactNode; name: string; values: number[]; selected: number[]; setSelected: SetValues<number>; min: string; setMin: (value: string) => void; max: string; setMax: (value: string) => void; open: string | null; setOpen: (value: string | null) => void }) {
  const visible = open === name;
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return <th className={[dataDisplayRecipes.tableHead, styles.filterHead, styles.filterHeadRight].join(" ")}><button ref={anchorRef} type="button" className={[styles.filterHeadButton, selected.length || min || max ? styles.filterHeadActive : ""].join(" ")} onClick={() => setOpen(visible ? null : name)}><span>{label}</span><SlidersHorizontal className="h-3.5 w-3.5" /></button>{visible ? <ColumnFilterPortal anchorRef={anchorRef} align="right"><ValueChecklist values={values} selected={selected} setSelected={setSelected} format={(value) => formatCurrencyCOP(value)} /><div className={styles.rangeSection}><span className={formRecipes.label}>Rango personalizado</span><div className={styles.rangeGrid}><input type="number" placeholder="Desde" className={formRecipes.control} value={min} onChange={(event) => setMin(event.target.value)} /><input type="number" placeholder="Hasta" className={formRecipes.control} value={max} onChange={(event) => setMax(event.target.value)} /></div></div></ColumnFilterPortal> : null}</th>;
}

function ColumnFilterPortal({ anchorRef, align = "left", children }: { anchorRef: RefObject<HTMLButtonElement | null>; align?: "left" | "right"; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useEffect(() => {
    let frame = 0;
    let previous = "";

    function positionPanel() {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) {
        frame = requestAnimationFrame(positionPanel);
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const viewportPadding = 8;
      const gap = 8;
      const preferredLeft = align === "right" ? anchorRect.right - panelWidth : anchorRect.left;
      const left = Math.min(Math.max(viewportPadding, preferredLeft), window.innerWidth - panelWidth - viewportPadding);
      const fitsBelow = anchorRect.bottom + gap + panelHeight <= window.innerHeight - viewportPadding;
      const top = fitsBelow
        ? anchorRect.bottom + gap
        : Math.max(viewportPadding, anchorRect.top - panelHeight - gap);
      const signature = `${left}:${top}:${panelWidth}:${panelHeight}`;

      if (signature !== previous) {
        previous = signature;
        setStyle({ left, top, visibility: "visible" });
      }
      frame = requestAnimationFrame(positionPanel);
    }

    frame = requestAnimationFrame(positionPanel);
    return () => cancelAnimationFrame(frame);
  }, [align, anchorRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={panelRef} data-client-filter-portal className={styles.columnFilterPopover} style={style}>
      {children}
    </div>,
    document.body,
  );
}

function ValueChecklist<T extends string | number>({ values, selected, setSelected, format = (value) => String(value) }: { values: T[]; selected: T[]; setSelected: SetValues<T>; format?: (value: T) => string }) {
  const [term, setTerm] = useState("");
  const shown = values.filter((value) => normalize(format(value)).includes(normalize(term)));
  const allShownSelected = shown.length > 0 && shown.every((value) => selected.includes(value));
  function toggle(value: T) { setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]); }
  return <div><input autoFocus className={formRecipes.control} placeholder="Buscar valores..." value={term} onChange={(event) => setTerm(event.target.value)} /><label className={`${styles.checkRow} ${formRecipes.filterSelectAll}`}><input type="checkbox" checked={allShownSelected} onChange={() => setSelected(allShownSelected ? selected.filter((value) => !shown.includes(value)) : unique([...selected, ...shown]))} /><span>Seleccionar todos</span></label><div className={styles.checkList}>{shown.map((value) => <label key={String(value)} className={`${styles.checkRow} ${formRecipes.filterOption}`}><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value)} /><span>{format(value)}</span></label>)}{shown.length === 0 ? <p className={styles.noValues}>Sin valores coincidentes.</p> : null}</div><button type="button" className={`${styles.clearColumn} ${formRecipes.filterAction}`} onClick={() => setSelected([])}>Limpiar filtro</button></div>;
}

function ResponsiveFilters(props: { idOptions: string[]; phoneOptions: string[]; companyOptions: string[]; referrerOptions: string[]; creditOptions: number[]; documentOptions: string[]; selectedIds: string[]; setSelectedIds: SetValues<string>; selectedPhones: string[]; setSelectedPhones: SetValues<string>; selectedCompanies: string[]; setSelectedCompanies: SetValues<string>; selectedReferrers: string[]; setSelectedReferrers: SetValues<string>; selectedCredits: number[]; setSelectedCredits: SetValues<number>; selectedDocuments: string[]; setSelectedDocuments: SetValues<string>; capitalMin: string; setCapitalMin: (v: string) => void; capitalMax: string; setCapitalMax: (v: string) => void; interestMin: string; setInterestMin: (v: string) => void; interestMax: string; setInterestMax: (v: string) => void }) {
  return <div className={styles.advancedFilterGrid}><MobileChecklist label="Cédula" values={props.idOptions} selected={props.selectedIds} setSelected={props.setSelectedIds} /><MobileChecklist label="Teléfono" values={props.phoneOptions} selected={props.selectedPhones} setSelected={props.setSelectedPhones} /><MobileChecklist label="Empresa" values={props.companyOptions} selected={props.selectedCompanies} setSelected={props.setSelectedCompanies} /><MobileChecklist label="Recomendado por" values={props.referrerOptions} selected={props.selectedReferrers} setSelected={props.setSelectedReferrers} format={formatReferrerValue} /><MobileChecklist label="Créditos activos" values={props.creditOptions} selected={props.selectedCredits} setSelected={props.setSelectedCredits} /><MobileChecklist label="Documentos" values={props.documentOptions} selected={props.selectedDocuments} setSelected={props.setSelectedDocuments} format={formatDocumentValue} /><RangeFilter label="Capital pendiente" min={props.capitalMin} max={props.capitalMax} onMin={props.setCapitalMin} onMax={props.setCapitalMax} /><RangeFilter label="Interés pendiente" min={props.interestMin} max={props.interestMax} onMin={props.setInterestMin} onMax={props.setInterestMax} /></div>;
}

function MobileChecklist<T extends string | number>(props: { label: string; values: T[]; selected: T[]; setSelected: SetValues<T>; format?: (value: T) => string }) { return <details className={styles.mobileDetails}><summary className={formRecipes.filterSummary}>{props.label}{props.selected.length ? ` (${props.selected.length})` : ""}</summary><ValueChecklist values={props.values} selected={props.selected} setSelected={props.setSelected} format={props.format} /></details>; }
function RangeFilter({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (value: string) => void; onMax: (value: string) => void }) { return <fieldset><legend className={formRecipes.label}>{label}</legend><div className={styles.rangeGrid}><input type="number" placeholder="Desde" value={min} className={formRecipes.control} onChange={(event) => onMin(event.target.value)} /><input type="number" placeholder="Hasta" value={max} className={formRecipes.control} onChange={(event) => onMax(event.target.value)} /></div></fieldset>; }
function EmptyFilters() { return <div className={styles.emptyBody}><p>No hay clientes para esta combinación de filtros.</p><span>Modifica el filtro abierto o usa Limpiar.</span></div>; }
function parseList(value: string | null) { return value ? value.split("|").map(decodeURIComponent).filter(Boolean) : []; }
function parseNumberList(value: string | null) { return parseList(value).map(Number).filter(Number.isFinite); }
function syncParam(params: URLSearchParams, key: string, value: string) { const clean = value.trim(); if (clean) params.set(key, clean); }
function syncList(params: URLSearchParams, key: string, values: string[]) { if (values.length) params.set(key, values.map(encodeURIComponent).join("|")); }
function syncNumberList(params: URLSearchParams, key: string, values: number[]) { if (values.length) params.set(key, values.join("|")); }
function unique<T>(values: T[]) { return [...new Set(values)]; }
function uniqueStrings(values: string[]) { return unique(values).sort((left, right) => left.localeCompare(right, "es")); }
function uniqueNumbers(values: number[]) { return unique(values).sort((left, right) => left - right); }
function normalize(value: string) { return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function withinRange(value: number, minRaw: string, maxRaw: string) { const min = minRaw === "" ? null : Number(minRaw); const max = maxRaw === "" ? null : Number(maxRaw); return (min === null || !Number.isFinite(min) || value >= min) && (max === null || !Number.isFinite(max) || value <= max); }

type ClientFacet = "cedula" | "telefono" | "empresa" | "recomendadoPor" | "creditos" | "documentos" | "capital" | "interes";
interface ClientFilterContext {
  normalizedSearch: string;
  portfolioState: string;
  selectedIds: string[];
  selectedPhones: string[];
  selectedCompanies: string[];
  selectedReferrers: string[];
  selectedCredits: number[];
  selectedDocuments: string[];
  selectedCapital: number[];
  selectedInterest: number[];
  capitalMin: string;
  capitalMax: string;
  interestMin: string;
  interestMax: string;
}

function matchesClientFilters(client: ClienteListadoItem, filters: ClientFilterContext, omittedFacet?: ClientFacet) {
  if (filters.normalizedSearch && !client.nombre.toLocaleLowerCase("es-CO").includes(filters.normalizedSearch)) return false;
  if (filters.portfolioState === "VENCIDA" && client.estadoCartera !== "ATRASADO" && client.estadoCartera !== "MORA") return false;
  if (filters.portfolioState && filters.portfolioState !== "VENCIDA" && client.estadoCartera !== filters.portfolioState) return false;
  if (omittedFacet !== "cedula" && filters.selectedIds.length && !filters.selectedIds.includes(client.cedula)) return false;
  if (omittedFacet !== "telefono" && filters.selectedPhones.length && !filters.selectedPhones.includes(client.telefono ?? "Sin teléfono")) return false;
  if (omittedFacet !== "empresa" && filters.selectedCompanies.length && !filters.selectedCompanies.includes(client.empresa ?? "Sin empresa")) return false;
  if (omittedFacet !== "recomendadoPor" && filters.selectedReferrers.length && !filters.selectedReferrers.includes(toReferrerFilterValue(client.recomienda))) return false;
  if (omittedFacet !== "creditos" && filters.selectedCredits.length && !filters.selectedCredits.includes(client.creditosActivos)) return false;
  if (omittedFacet !== "documentos" && filters.selectedDocuments.length && !filters.selectedDocuments.includes(client.estadoDocumentos)) return false;
  if (omittedFacet !== "capital") {
    if (filters.selectedCapital.length && !filters.selectedCapital.includes(client.saldoTotal)) return false;
    if (!withinRange(client.saldoTotal, filters.capitalMin, filters.capitalMax)) return false;
  }
  if (omittedFacet !== "interes") {
    if (filters.selectedInterest.length && !filters.selectedInterest.includes(client.interesPendienteTotal)) return false;
    if (!withinRange(client.interesPendienteTotal, filters.interestMin, filters.interestMax)) return false;
  }
  return true;
}
const EMPTY_REFERRER = "__EMPTY__";
function toReferrerFilterValue(value: string | null) { return value?.trim() || EMPTY_REFERRER; }
function formatReferrerValue(value: string) { return value === EMPTY_REFERRER ? "Sin recomendador" : value; }
function formatReferrerDisplay(value: string | null) { return value?.trim() || "—"; }
function formatDocumentValue(value: string) { return value === "DOCUMENTOS_CARGADOS" ? "Cargados" : "Pendientes"; }

function DocumentStatus({ status }: { status: string }) {
  if (status === "DOCUMENTOS_CARGADOS") return <span className={statusRecipes.success}><CheckCircle2 className="h-3.5 w-3.5" />Cargados</span>;
  return <span className={statusRecipes.warning}><AlertTriangle className="h-3.5 w-3.5" />Pendientes</span>;
}
