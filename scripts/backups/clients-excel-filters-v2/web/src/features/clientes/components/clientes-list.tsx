"use client";

import type { ComponentType, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
  const [documentState, setDocumentState] = useState(estadoDocumentos);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [openColumnFilter, setOpenColumnFilter] = useState<string | null>(null);
  const filtersRef = useRef<HTMLTableSectionElement | null>(null);
  const [portfolioState, setPortfolioState] = useState(() => searchParams.get("cartera") ?? "");
  const [idFilter, setIdFilter] = useState(() => searchParams.get("cedula") ?? "");
  const [phoneFilter, setPhoneFilter] = useState(() => searchParams.get("telefono") ?? "");
  const [companyFilter, setCompanyFilter] = useState(() => searchParams.get("empresa") ?? "");
  const [creditsMin, setCreditsMin] = useState(() => searchParams.get("creditosMin") ?? "");
  const [creditsMax, setCreditsMax] = useState(() => searchParams.get("creditosMax") ?? "");
  const [capitalMin, setCapitalMin] = useState(() => searchParams.get("capitalMin") ?? "");
  const [capitalMax, setCapitalMax] = useState(() => searchParams.get("capitalMax") ?? "");
  const [interestMin, setInterestMin] = useState(() => searchParams.get("interesMin") ?? "");
  const [interestMax, setInterestMax] = useState(() => searchParams.get("interesMax") ?? "");
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedSearch = searchValue.trim().toLocaleLowerCase("es-CO");

  const filteredClients = useMemo(() => {
    return clientes.filter((cliente) => {
      if (normalizedSearch && !cliente.nombre.toLocaleLowerCase("es-CO").includes(normalizedSearch)) return false;
      if (portfolioState && cliente.estadoCartera !== portfolioState) return false;
      if (documentState && cliente.estadoDocumentos !== documentState) return false;
      if (idFilter && !cliente.cedula.toLocaleLowerCase("es-CO").includes(idFilter.trim().toLocaleLowerCase("es-CO"))) return false;
      if (phoneFilter && !(cliente.telefono ?? "").toLocaleLowerCase("es-CO").includes(phoneFilter.trim().toLocaleLowerCase("es-CO"))) return false;
      if (companyFilter && !(cliente.empresa ?? "").toLocaleLowerCase("es-CO").includes(companyFilter.trim().toLocaleLowerCase("es-CO"))) return false;
      return withinRange(cliente.creditosActivos, creditsMin, creditsMax) &&
        withinRange(cliente.saldoTotal, capitalMin, capitalMax) &&
        withinRange(cliente.interesPendienteTotal, interestMin, interestMax);
    });
  }, [capitalMax, capitalMin, clientes, companyFilter, creditsMax, creditsMin, documentState, idFilter, interestMax, interestMin, normalizedSearch, phoneFilter, portfolioState]);

  const suggestions = useMemo(() => filteredClients.slice(0, 10), [filteredClients]);
  const profilesPending = filteredClients.filter((client) => client.perfilIncompleto);
  const documentsPending = filteredClients.filter((client) => client.estadoDocumentos === "FALTAN_DOCUMENTOS");
  const activeCredits = filteredClients.reduce((total, client) => total + client.creditosActivos, 0);
  const clientsWithActiveCredit = filteredClients.filter((client) => client.creditosActivos > 0).length;
  const activeFilterCount = [searchValue.trim(), portfolioState, idFilter, phoneFilter, companyFilter, creditsMin, creditsMax, capitalMin, capitalMax, interestMin, interestMax, documentState].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const cleanQuery = searchValue.trim();

      if (cleanQuery) params.set("q", cleanQuery);
      else params.delete("q");

      syncParam(params, "cartera", portfolioState);
      syncParam(params, "cedula", idFilter);
      syncParam(params, "telefono", phoneFilter);
      syncParam(params, "empresa", companyFilter);
      syncParam(params, "creditosMin", creditsMin);
      syncParam(params, "creditosMax", creditsMax);
      syncParam(params, "capitalMin", capitalMin);
      syncParam(params, "capitalMax", capitalMax);
      syncParam(params, "interesMin", interestMin);
      syncParam(params, "interesMax", interestMax);
      syncParam(params, "estadoDocumentos", documentState);

      const nextUrl = params.size > 0
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.replace(nextUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
  }, [capitalMax, capitalMin, companyFilter, creditsMax, creditsMin, documentState, idFilter, interestMax, interestMin, pathname, phoneFilter, portfolioState, router, searchParams, searchValue]);

  useEffect(() => {
    function closeColumnFilter(event: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) setOpenColumnFilter(null);
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

  function clearFilters() {
    setSearchValue("");
    setDocumentState("");
    setPortfolioState("");
    setIdFilter("");
    setPhoneFilter("");
    setCompanyFilter("");
    setCreditsMin("");
    setCreditsMax("");
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

      <section className={surfaceRecipes.sectionCompact}>
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
                                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{client.nombre}</p>
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

          <button type="button" className={[actionRecipes.secondary, styles.mobileFilterButton].join(" ")} onClick={() => setMobileFiltersOpen((current) => !current)} aria-expanded={mobileFiltersOpen} aria-controls="client-document-filter">
            <Filter className="h-4 w-4" />
            Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
            <ChevronDown className={["h-4 w-4 transition", mobileFiltersOpen ? "rotate-180" : ""].join(" ")} />
          </button>

          <div id="client-document-filter" className={[styles.documentFilter, mobileFiltersOpen ? styles.documentFilterOpen : ""].join(" ")}>
            <label className="block"><span className={formRecipes.label}>Estado de cartera</span><select value={portfolioState} className={formRecipes.control} onChange={(event) => setPortfolioState(event.target.value)}><option value="">Todos</option><option value="AL_DIA">Al día</option><option value="ATRASADO">Con cuotas atrasadas</option><option value="MORA">En mora</option><option value="SIN_CREDITOS_ACTIVOS">Sin créditos activos</option></select></label>
            <div className={styles.compactAdvancedFilters}><AdvancedFilters idFilter={idFilter} setIdFilter={setIdFilter} phoneFilter={phoneFilter} setPhoneFilter={setPhoneFilter} companyFilter={companyFilter} setCompanyFilter={setCompanyFilter} creditsMin={creditsMin} setCreditsMin={setCreditsMin} creditsMax={creditsMax} setCreditsMax={setCreditsMax} capitalMin={capitalMin} setCapitalMin={setCapitalMin} capitalMax={capitalMax} setCapitalMax={setCapitalMax} interestMin={interestMin} setInterestMin={setInterestMin} interestMax={interestMax} setInterestMax={setInterestMax} documentState={documentState} setDocumentState={setDocumentState} /></div>
          </div>

          {hasActiveFilters ? <button type="button" className={actionRecipes.secondary} onClick={clearFilters}>Limpiar</button> : null}
        </div>
      </section>

      <section className={surfaceRecipes.stickyDataPanel}>
        <div className={surfaceRecipes.dataPanelHeader}>
          <div><h3 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Clientes</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{filteredClients.length} registro(s)</p></div>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-10 text-center"><p className="text-sm font-semibold text-[var(--color-text-primary)]">No hay clientes para los filtros seleccionados.</p><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Ajusta la búsqueda o crea un nuevo cliente.</p></div>
        ) : (
          <>
            <div className={styles.compactList}>{filteredClients.map((client) => <ClientCompactRow key={client.id} client={client} onOpen={openClient} onKeyDown={handleRowKeyDown} />)}</div>
            <div className={styles.desktopTable}>
              <table className={styles.clientTable}>
                <colgroup>
                  <col className={styles.clientColumn} />
                  <col className={styles.idColumn} />
                  <col className={styles.phoneColumn} />
                  <col className={styles.companyColumn} />
                  <col className={styles.creditsColumn} />
                  <col className={styles.capitalColumn} />
                  <col className={styles.interestColumn} />
                  <col className={styles.documentsColumn} />
                </colgroup>
                <thead ref={filtersRef} className="bg-[var(--color-surface-subtle)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]"><tr><TableHead>Cliente</TableHead><FilterHead label="Cédula" name="cedula" active={Boolean(idFilter)} open={openColumnFilter} setOpen={setOpenColumnFilter}><TextFilter label="Contiene" value={idFilter} onChange={setIdFilter} /></FilterHead><FilterHead label="Teléfono" name="telefono" active={Boolean(phoneFilter)} open={openColumnFilter} setOpen={setOpenColumnFilter}><TextFilter label="Contiene" value={phoneFilter} onChange={setPhoneFilter} /></FilterHead><FilterHead label="Empresa" name="empresa" active={Boolean(companyFilter)} open={openColumnFilter} setOpen={setOpenColumnFilter}><TextFilter label="Contiene" value={companyFilter} onChange={setCompanyFilter} /></FilterHead><FilterHead label={<>Créditos<br />activos</>} name="creditos" active={Boolean(creditsMin || creditsMax)} open={openColumnFilter} setOpen={setOpenColumnFilter}><RangeFilter label="Cantidad" min={creditsMin} max={creditsMax} onMin={setCreditsMin} onMax={setCreditsMax} /></FilterHead><FilterHead label={<>Capital<br />pendiente</>} name="capital" active={Boolean(capitalMin || capitalMax)} open={openColumnFilter} setOpen={setOpenColumnFilter} align="right"><RangeFilter label="Valor" min={capitalMin} max={capitalMax} onMin={setCapitalMin} onMax={setCapitalMax} /></FilterHead><FilterHead label={<>Interés<br />pendiente</>} name="interes" active={Boolean(interestMin || interestMax)} open={openColumnFilter} setOpen={setOpenColumnFilter} align="right"><RangeFilter label="Valor" min={interestMin} max={interestMax} onMin={setInterestMin} onMax={setInterestMax} /></FilterHead><FilterHead label="Documentos" name="documentos" active={Boolean(documentState)} open={openColumnFilter} setOpen={setOpenColumnFilter} align="right"><label className="block"><span className={formRecipes.label}>Estado</span><select value={documentState} className={formRecipes.control} onChange={(event) => setDocumentState(event.target.value)}><option value="">Todos</option><option value="DOCUMENTOS_CARGADOS">Cargados</option><option value="FALTAN_DOCUMENTOS">Pendientes</option></select></label></FilterHead></tr></thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredClients.map((client) => (
                    <tr key={client.id} role="link" tabIndex={0} onClick={() => openClient(client.id)} onKeyDown={(event) => handleRowKeyDown(event, client.id)} className={dataDisplayRecipes.operationalRow}>
                      <TableCell><div className={styles.clientIdentityCell}><div className="flex min-w-0 items-start gap-3"><div className={dataDisplayRecipes.entityAvatar}><UserRound className="h-4 w-4" /></div><div className="min-w-0"><Link href={`/clientes/${client.id}`} className={dataDisplayRecipes.entityLink} onClick={(event) => event.stopPropagation()}>{client.nombre}</Link>{client.perfilIncompleto ? <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">Perfil pendiente</p> : null}</div></div><Link href={`/clientes/${client.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del cliente" aria-label={`Ver detalle de ${client.nombre}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link></div></TableCell>
                      <TableCell className={styles.atomicValue}>{client.cedula}</TableCell><TableCell className={styles.atomicValue}>{client.telefono || "-"}</TableCell><TableCell>{client.empresa || "-"}</TableCell><TableCell className={`${styles.atomicValue} text-center tabular-nums`}>{client.creditosActivos}</TableCell>
                      <TableCell className={`${styles.atomicValue} text-right font-semibold text-[var(--color-text-primary)] tabular-nums`}>{formatCurrencyCOP(client.saldoTotal)}</TableCell>
                      <TableCell className={`${styles.atomicValue} text-right font-semibold text-[var(--color-text-primary)] tabular-nums`}>{formatCurrencyCOP(client.interesPendienteTotal)}</TableCell>
                      <TableCell><DocumentStatus status={client.estadoDocumentos} /></TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
        <div className="flex min-w-0 items-start gap-3"><div className={dataDisplayRecipes.entityAvatar}><UserRound className="h-4 w-4" /></div><div className="min-w-0"><Link href={`/clientes/${client.id}`} className={dataDisplayRecipes.compactEntityLink}>{client.nombre}</Link><p className="text-xs text-[var(--color-text-secondary)]">C.C. {client.cedula}</p>{client.perfilIncompleto ? <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">Perfil pendiente</p> : null}</div></div>
        <Link href={`/clientes/${client.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del cliente" aria-label={`Ver detalle de ${client.nombre}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link>
      </div>
      <dl className={styles.flatDataGrid}><FlatDatum label="Teléfono" value={client.telefono || "-"} /><FlatDatum label="Empresa" value={client.empresa || "-"} /><FlatDatum label="Créditos" value={String(client.creditosActivos)} /><FlatDatum label="Capital pendiente" value={formatCurrencyCOP(client.saldoTotal)} /><FlatDatum label="Interés pendiente" value={formatCurrencyCOP(client.interesPendienteTotal)} /><div className="min-w-0"><dt className={dataDisplayRecipes.flatDatumLabel}>Documentos</dt><dd className={styles.compactStatus}><DocumentStatus status={client.estadoDocumentos} /></dd></div></dl>
    </article>
  );
}

function FlatDatum({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className={dataDisplayRecipes.flatDatumLabel}>{label}</dt><dd className={dataDisplayRecipes.flatDatumValue}>{value}</dd></div>; }

interface PortfolioMetricProps { icon: ComponentType<{ className?: string }>; label: string; value: string; helper?: string; }
function PortfolioMetric({ icon: Icon, label, value, helper }: PortfolioMetricProps) { return <div className={[dataDisplayRecipes.metric, styles.metric].join(" ")}><p className={dataDisplayRecipes.metricLabel}><Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)]" />{label}</p><p className={dataDisplayRecipes.metricValue}>{value}</p>{helper ? <p className={dataDisplayRecipes.metricHelper}>{helper}</p> : null}</div>; }

interface TableCellProps { className?: string; children: ReactNode; }
function TableCell({ className = "", children }: TableCellProps) { return <td className={`${dataDisplayRecipes.tableCell} ${className}`}>{children}</td>; }
interface TableHeadProps { className?: string; children: ReactNode; }
function TableHead({ className = "", children }: TableHeadProps) { return <th className={`${dataDisplayRecipes.tableHead} ${className}`}>{children}</th>; }

interface AdvancedFiltersProps { idFilter: string; setIdFilter: (v: string) => void; phoneFilter: string; setPhoneFilter: (v: string) => void; companyFilter: string; setCompanyFilter: (v: string) => void; creditsMin: string; setCreditsMin: (v: string) => void; creditsMax: string; setCreditsMax: (v: string) => void; capitalMin: string; setCapitalMin: (v: string) => void; capitalMax: string; setCapitalMax: (v: string) => void; interestMin: string; setInterestMin: (v: string) => void; interestMax: string; setInterestMax: (v: string) => void; documentState: string; setDocumentState: (v: string) => void; }
function AdvancedFilters(p: AdvancedFiltersProps) { return <div className={styles.advancedFilterGrid}><TextFilter label="Cédula" value={p.idFilter} onChange={p.setIdFilter} /><TextFilter label="Teléfono" value={p.phoneFilter} onChange={p.setPhoneFilter} /><TextFilter label="Empresa" value={p.companyFilter} onChange={p.setCompanyFilter} /><RangeFilter label="Créditos activos" min={p.creditsMin} max={p.creditsMax} onMin={p.setCreditsMin} onMax={p.setCreditsMax} /><RangeFilter label="Capital pendiente" min={p.capitalMin} max={p.capitalMax} onMin={p.setCapitalMin} onMax={p.setCapitalMax} /><RangeFilter label="Interés pendiente" min={p.interestMin} max={p.interestMax} onMin={p.setInterestMin} onMax={p.setInterestMax} /><label><span className={formRecipes.label}>Documentos</span><select value={p.documentState} className={formRecipes.control} onChange={(e) => p.setDocumentState(e.target.value)}><option value="">Todos</option><option value="DOCUMENTOS_CARGADOS">Cargados</option><option value="FALTAN_DOCUMENTOS">Pendientes</option></select></label></div>; }
function TextFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className={formRecipes.label}>{label}</span><input value={value} className={formRecipes.control} onChange={(e) => onChange(e.target.value)} /></label>; }
function RangeFilter({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (value: string) => void; onMax: (value: string) => void }) { return <fieldset><legend className={formRecipes.label}>{label}</legend><div className={styles.rangeGrid}><input type="number" inputMode="decimal" placeholder="Mínimo" value={min} className={formRecipes.control} onChange={(e) => onMin(e.target.value)} /><input type="number" inputMode="decimal" placeholder="Máximo" value={max} className={formRecipes.control} onChange={(e) => onMax(e.target.value)} /></div></fieldset>; }
function FilterHead({ label, name, active, open, setOpen, align = "left", children }: { label: ReactNode; name: string; active: boolean; open: string | null; setOpen: (value: string | null) => void; align?: "left" | "right"; children: ReactNode }) { const visible = open === name; return <th className={[dataDisplayRecipes.tableHead, styles.filterHead, align === "right" ? styles.filterHeadRight : ""].join(" ")}><button type="button" className={[styles.filterHeadButton, active ? styles.filterHeadActive : ""].join(" ")} onClick={() => setOpen(visible ? null : name)} aria-expanded={visible}><span>{label}</span><SlidersHorizontal className="h-3.5 w-3.5" /></button>{visible ? <div className={styles.columnFilterPopover}>{children}<button type="button" className={styles.closeFilter} onClick={() => setOpen(null)}>Cerrar</button></div> : null}</th>; }
function syncParam(params: URLSearchParams, key: string, value: string) { const clean = value.trim(); if (clean) params.set(key, clean); else params.delete(key); }
function withinRange(value: number, minRaw: string, maxRaw: string) { const min = minRaw === "" ? null : Number(minRaw); const max = maxRaw === "" ? null : Number(maxRaw); return (min === null || !Number.isFinite(min) || value >= min) && (max === null || !Number.isFinite(max) || value <= max); }

function DocumentStatus({ status }: { status: string }) {
  if (status === "DOCUMENTOS_CARGADOS") return <span className={statusRecipes.success}><CheckCircle2 className="h-3.5 w-3.5" />Cargados</span>;
  return <span className={statusRecipes.warning}><AlertTriangle className="h-3.5 w-3.5" />Pendientes</span>;
}
