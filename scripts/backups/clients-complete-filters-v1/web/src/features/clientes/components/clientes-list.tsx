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
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedSearch = searchValue.trim().toLocaleLowerCase("es-CO");

  const filteredClients = useMemo(() => {
    return clientes.filter((cliente) => {
      const matchesDocuments = !documentState || cliente.estadoDocumentos === documentState;
      if (!matchesDocuments) return false;
      if (!normalizedSearch) return true;

      const searchable = [
        cliente.nombre,
        cliente.cedula,
        cliente.telefono ?? "",
        cliente.empresa ?? "",
        cliente.contacto ?? "",
        cliente.contacto2 ?? "",
        cliente.recomienda ?? "",
      ].join(" ").toLocaleLowerCase("es-CO");

      return searchable.includes(normalizedSearch);
    });
  }, [clientes, documentState, normalizedSearch]);

  const suggestions = useMemo(() => filteredClients.slice(0, 10), [filteredClients]);
  const profilesPending = filteredClients.filter((client) => client.perfilIncompleto);
  const documentsPending = filteredClients.filter((client) => client.estadoDocumentos === "FALTAN_DOCUMENTOS");
  const activeCredits = filteredClients.reduce((total, client) => total + client.creditosActivos, 0);
  const clientsWithActiveCredit = filteredClients.filter((client) => client.creditosActivos > 0).length;
  const hasActiveFilters = Boolean(searchValue.trim() || documentState);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const cleanQuery = searchValue.trim();

      if (cleanQuery) params.set("q", cleanQuery);
      else params.delete("q");

      if (documentState) params.set("estadoDocumentos", documentState);
      else params.delete("estadoDocumentos");

      const nextUrl = params.size > 0
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.replace(nextUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
  }, [documentState, pathname, router, searchParams, searchValue]);

  function handleDocumentState(value: string) {
    setDocumentState(value);
  }

  function clearFilters() {
    setSearchValue("");
    setDocumentState("");
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
            <span className={formRecipes.labelWithIcon}><Search className="h-4 w-4 text-[var(--color-action-primary)]" />Buscar cliente</span>
            <div className="relative">
              <Search className={styles.searchIcon} aria-hidden="true" />
              <input
                value={searchValue}
                placeholder="Nombre, cédula, teléfono, empresa o contacto"
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
            Filtros{documentState ? " (1)" : ""}
            <ChevronDown className={["h-4 w-4 transition", mobileFiltersOpen ? "rotate-180" : ""].join(" ")} />
          </button>

          <div id="client-document-filter" className={[styles.documentFilter, mobileFiltersOpen ? styles.documentFilterOpen : ""].join(" ")}>
            <label className="block">
              <span className={formRecipes.label}>Documentos</span>
              <select value={documentState} className={formRecipes.control} onChange={(event) => handleDocumentState(event.target.value)}>
                <option value="">Todos</option>
                <option value="FALTAN_DOCUMENTOS">Faltan documentos</option>
                <option value="DOCUMENTOS_CARGADOS">Documentos cargados</option>
              </select>
            </label>
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
                <thead className="bg-[var(--color-surface-subtle)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]"><tr><TableHead>Cliente</TableHead><TableHead>Cédula</TableHead><TableHead>Teléfono</TableHead><TableHead>Empresa</TableHead><TableHead className="text-center"><span>Créditos<br />activos</span></TableHead><TableHead className="text-right"><span>Capital<br />pendiente</span></TableHead><TableHead className="text-right"><span>Interés<br />pendiente</span></TableHead><TableHead>Documentos</TableHead></tr></thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredClients.map((client) => (
                    <tr key={client.id} role="link" tabIndex={0} onClick={() => openClient(client.id)} onKeyDown={(event) => handleRowKeyDown(event, client.id)} className={dataDisplayRecipes.operationalRow}>
                      <TableCell><div className={styles.clientIdentityCell}><div className="flex min-w-0 items-start gap-3"><div className={dataDisplayRecipes.entityAvatar}><UserRound className="h-4 w-4" /></div><div className="min-w-0"><Link href={`/clientes/${client.id}`} className={dataDisplayRecipes.entityLink} onClick={(event) => event.stopPropagation()}>{client.nombre}</Link>{client.perfilIncompleto ? <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">Perfil pendiente</p> : null}</div></div><Link href={`/clientes/${client.id}`} className={actionRecipes.entityDetailIcon} title="Ver detalle del cliente" aria-label={`Ver detalle de ${client.nombre}`} onClick={(event) => event.stopPropagation()}><Eye className="h-4 w-4" /></Link></div></TableCell>
                      <TableCell>{client.cedula}</TableCell><TableCell>{client.telefono || "-"}</TableCell><TableCell>{client.empresa || "-"}</TableCell><TableCell className="text-center tabular-nums">{client.creditosActivos}</TableCell>
                      <TableCell className="text-right font-semibold text-[var(--color-text-primary)] tabular-nums">{formatCurrencyCOP(client.saldoTotal)}</TableCell>
                      <TableCell className="text-right font-semibold text-[var(--color-text-primary)] tabular-nums">{formatCurrencyCOP(client.interesPendienteTotal)}</TableCell>
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

function DocumentStatus({ status }: { status: string }) {
  if (status === "DOCUMENTOS_CARGADOS") return <span className={statusRecipes.success}><CheckCircle2 className="h-3.5 w-3.5" />Cargados</span>;
  return <span className={statusRecipes.warning}><AlertTriangle className="h-3.5 w-3.5" />Pendientes</span>;
}
