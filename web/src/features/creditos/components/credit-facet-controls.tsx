"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, SlidersHorizontal, X } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { formatCurrencyCOP, formatPercent } from "@/lib/formatters";
import type { CreditFacetCatalogs } from "../credit-facets";
import styles from "./credit-facet-controls.module.css";

type FacetName = "codigo" | "cliente" | "cuotasAtrasadas" | "monto" | "capital" | "interes" | "proximaCuota" | "tasa";
type ListKey = "codigos" | "clientes" | "cuotasAtrasadas" | "montos" | "capitales" | "intereses" | "tasas";

interface FacetHeadProps {
  facet: FacetName;
  label: ReactNode;
  catalogs: CreditFacetCatalogs;
  align?: "right";
  className?: string;
}

export function CreditFacetHead({ facet, label, catalogs, align, className = "" }: FacetHeadProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const active = facetActive(useSearchParams(), facet);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Element;
      const insideAnchor = anchorRef.current?.contains(target) ?? false;
      const insidePortal = Boolean(target.closest("[data-credit-facet-portal]"));
      if (!insideAnchor && !insidePortal) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <th className={[dataDisplayRecipes.tableHead, styles.filterHead, align ? styles.alignRight : "", className].join(" ")}>
      <button ref={anchorRef} type="button" className={[styles.filterHeadButton, active ? styles.active : ""].join(" ")} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{label}</span><SlidersHorizontal className={styles.icon} />
      </button>
      {open ? <FacetPortal anchorRef={anchorRef} align={align} onClose={() => setOpen(false)}><FacetBody facet={facet} catalogs={catalogs} /></FacetPortal> : null}
    </th>
  );
}

export function OverdueInstallmentCountFilter({ catalogs }: { catalogs: CreditFacetCatalogs }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const selected = useSearchParams()
    .get("cuotasAtrasadas")
    ?.split("|")
    .filter(Boolean)
    .map(safeDecode) ?? [];
  const summary = selected.length === 0 ? "Todas" : selected.join(", ");

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Element;
      const insideAnchor = anchorRef.current?.contains(target) ?? false;
      const insidePortal = Boolean(target.closest("[data-credit-facet-portal]"));
      if (!insideAnchor && !insidePortal) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className={styles.topFacet}>
      <span className={formRecipes.label}>Cuotas atrasadas</span>
      <button
        ref={anchorRef}
        type="button"
        className={`${actionRecipes.secondary} ${styles.topFacetButton}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Filtrar por cantidades exactas de cuotas atrasadas. Selección: ${summary}`}
      >
        <span>{summary}</span>
        <SlidersHorizontal className={styles.icon} />
      </button>
      {open ? (
        <FacetPortal anchorRef={anchorRef} onClose={() => setOpen(false)}>
          <Checklist
            param="cuotasAtrasadas"
            values={catalogs.cuotasAtrasadas.map((value) => ({
              value: String(value),
              label: String(value),
            }))}
          />
        </FacetPortal>
      ) : null}
    </div>
  );
}

export function ResponsiveCreditFilters({ catalogs }: { catalogs: CreditFacetCatalogs }) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const count = activeFacetCount(searchParams);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <>
      <button type="button" className={`${actionRecipes.secondary} ${styles.responsiveButton}`} onClick={() => setOpen(true)} aria-expanded={open}>
        <Filter className={styles.icon} /> Filtros{count ? ` (${count})` : ""}
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div className={styles.layer}>
          <button type="button" className={styles.backdrop} onClick={() => setOpen(false)} aria-label="Cerrar filtros" />
          <section className={`${surfaceRecipes.filterOverlayPanel} ${styles.panel}`} role="dialog" aria-modal="true" aria-label="Filtros de créditos">
            <header className={styles.panelHeader}><div><h2>Filtros</h2><p>{count ? `${count} criterio(s) activo(s)` : "Selecciona criterios adicionales"}</p></div><button type="button" className={actionRecipes.entityDetailIcon} onClick={() => setOpen(false)} aria-label="Cerrar filtros"><X className={styles.icon} /></button></header>
            <div className={styles.panelBody}>
              <MobileFacet title="Código"><FacetBody facet="codigo" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Cliente"><FacetBody facet="cliente" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Cuotas atrasadas"><FacetBody facet="cuotasAtrasadas" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Monto original"><FacetBody facet="monto" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Capital pendiente"><FacetBody facet="capital" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Interés pendiente"><FacetBody facet="interes" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Próxima cuota"><FacetBody facet="proximaCuota" catalogs={catalogs} /></MobileFacet>
              <MobileFacet title="Tasa"><FacetBody facet="tasa" catalogs={catalogs} /></MobileFacet>
            </div>
            <footer className={styles.panelFooter}>{count ? <ClearAll /> : <span />}<button type="button" className={actionRecipes.primary} onClick={() => setOpen(false)}>Cerrar</button></footer>
          </section>
        </div>, document.body) : null}
    </>
  );
}

function MobileFacet({ title, children }: { title: string; children: ReactNode }) {
  return <details className={styles.mobileFacet}><summary>{title}</summary><div className={styles.mobileFacetBody}>{children}</div></details>;
}

function FacetBody({ facet, catalogs }: { facet: FacetName; catalogs: CreditFacetCatalogs }) {
  if (facet === "codigo") return <Checklist param="codigos" values={catalogs.codigos.map((value) => ({ value, label: value }))} />;
  if (facet === "cliente") return <Checklist param="clientes" values={catalogs.clientes.map((value) => ({ value: value.id, label: `${value.nombre} · ${value.cedula}` }))} />;
  if (facet === "cuotasAtrasadas") return <Checklist param="cuotasAtrasadas" values={catalogs.cuotasAtrasadas.map((value) => ({ value: String(value), label: String(value) }))} />;
  if (facet === "monto") return <NumericFacet param="montos" minParam="montoMin" maxParam="montoMax" values={catalogs.montos} format={formatCurrencyCOP} />;
  if (facet === "capital") return <NumericFacet param="capitales" minParam="capitalMin" maxParam="capitalMax" values={catalogs.capitales} format={formatCurrencyCOP} />;
  if (facet === "interes") return <NumericFacet param="intereses" minParam="interesMin" maxParam="interesMax" values={catalogs.intereses} format={formatCurrencyCOP} />;
  if (facet === "tasa") return <NumericFacet param="tasas" minParam="tasaMin" maxParam="tasaMax" values={catalogs.tasas} format={formatPercent} step="0.000001" />;
  return <InstallmentFacet catalogs={catalogs} />;
}

function Checklist({ param, values }: { param: ListKey; values: Array<{ value: string; label: string }> }) {
  const { selected, setList } = useListParam(param);
  const [term, setTerm] = useState("");
  const shown = useMemo(() => values.filter((item) => normalize(item.label).includes(normalize(term))), [term, values]);
  return <div><input className={formRecipes.control} value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar valor" /><div className={styles.checkList}>{shown.map((item) => <label key={item.value} className={styles.checkRow}><input type="checkbox" checked={selected.includes(item.value)} onChange={() => setList(selected.includes(item.value) ? selected.filter((value) => value !== item.value) : [...selected, item.value])} /><span>{item.label}</span></label>)}{shown.length === 0 ? <p className={styles.noValues}>Sin valores coincidentes.</p> : null}</div>{selected.length ? <button type="button" className={styles.clearFacet} onClick={() => setList([])}>Limpiar filtro</button> : null}</div>;
}

function NumericFacet({ param, minParam, maxParam, values, format, step = "1" }: { param: ListKey; minParam: string; maxParam: string; values: number[]; format: (value: number) => string; step?: string }) {
  const items = values.map((value) => ({ value: String(value), label: format(value) }));
  return <div><Checklist param={param} values={items} /><RangeInputs minParam={minParam} maxParam={maxParam} step={step} /></div>;
}

function RangeInputs({ minParam, maxParam, step = "1" }: { minParam: string; maxParam: string; step?: string }) {
  const { get, set } = useParams();
  return <div className={styles.rangeSection}><span className={formRecipes.label}>Rango personalizado</span><div className={styles.rangeGrid}><input type="number" step={step} placeholder="Desde" className={formRecipes.control} value={get(minParam)} onChange={(event) => set(minParam, event.target.value)} /><input type="number" step={step} placeholder="Hasta" className={formRecipes.control} value={get(maxParam)} onChange={(event) => set(maxParam, event.target.value)} /></div></div>;
}

function InstallmentFacet({ catalogs }: { catalogs: CreditFacetCatalogs }) {
  const { get, set } = useParams();
  const noInstallment = get("sinProximaCuota") === "1";
  return <div className={styles.installmentGrid}><label className={styles.checkRow}><input type="checkbox" checked={noInstallment} disabled={!catalogs.proximaCuota.incluyeSinProximaCuota && !noInstallment} onChange={(event) => set("sinProximaCuota", event.target.checked ? "1" : "")} />Sin próxima cuota</label><span className={formRecipes.label}>Fecha programada</span><div className={styles.rangeGrid}><input type="date" className={formRecipes.control} value={get("proximaFechaDesde")} onChange={(event) => set("proximaFechaDesde", event.target.value)} /><input type="date" className={formRecipes.control} value={get("proximaFechaHasta")} onChange={(event) => set("proximaFechaHasta", event.target.value)} /></div><RangeInputs minParam="proximaValorMin" maxParam="proximaValorMax" /></div>;
}

function ClearAll() {
  const { clearAdvanced } = useParams();
  return <button type="button" className={actionRecipes.secondary} onClick={clearAdvanced}>Limpiar filtros</button>;
}

function useListParam(param: ListKey) {
  const { get, set } = useParams();
  const selected = get(param).split("|").filter(Boolean).map(safeDecode);
  return { selected, setList: (values: string[]) => set(param, values.length ? values.map(encodeURIComponent).join("|") : "") };
}

function useParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function update(mutator: (params: URLSearchParams) => void) { const params = new URLSearchParams(searchParams.toString()); mutator(params); params.delete("page"); router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false }); }
  return {
    get: (key: string) => searchParams.get(key) ?? "",
    set: (key: string, value: string) => update((params) => { if (value) params.set(key, value); else params.delete(key); }),
    clearAdvanced: () => update((params) => ADVANCED_PARAMS.forEach((key) => params.delete(key))),
  };
}

function FacetPortal({ anchorRef, align = "left", onClose, children }: { anchorRef: RefObject<HTMLButtonElement | null>; align?: "left" | "right"; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    let frame = 0;
    const position = () => { const anchor = anchorRef.current; const panel = panelRef.current; if (!anchor || !panel) return; const rect = anchor.getBoundingClientRect(); const left = Math.min(Math.max(8, align === "right" ? rect.right - panel.offsetWidth : rect.left), window.innerWidth - panel.offsetWidth - 8); const below = rect.bottom + 8; const top = below + panel.offsetHeight <= window.innerHeight - 8 ? below : Math.max(8, rect.top - panel.offsetHeight - 8); setStyle({ left, top, visibility: "visible" }); };
    frame = requestAnimationFrame(position);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", close); };
  }, [align, anchorRef, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(<div ref={panelRef} className={styles.popover} style={style} data-credit-facet-portal>{children}</div>, document.body);
}

const ADVANCED_PARAMS = ["codigos", "clientes", "cuotasAtrasadas", "montos", "montoMin", "montoMax", "capitales", "capitalMin", "capitalMax", "intereses", "interesMin", "interesMax", "proximaFechaDesde", "proximaFechaHasta", "proximaValorMin", "proximaValorMax", "sinProximaCuota", "tasas", "tasaMin", "tasaMax"];
function activeFacetCount(params: URLSearchParams) { return ADVANCED_PARAMS.filter((key) => Boolean(params.get(key))).length; }
function facetActive(params: URLSearchParams, facet: FacetName) { const map: Record<FacetName, string[]> = { codigo: ["codigos"], cliente: ["clientes"], cuotasAtrasadas: ["cuotasAtrasadas"], monto: ["montos", "montoMin", "montoMax"], capital: ["capitales", "capitalMin", "capitalMax"], interes: ["intereses", "interesMin", "interesMax"], proximaCuota: ["proximaFechaDesde", "proximaFechaHasta", "proximaValorMin", "proximaValorMax", "sinProximaCuota"], tasa: ["tasas", "tasaMin", "tasaMax"] }; return map[facet].some((key) => Boolean(params.get(key))); }
function normalize(value: string) { return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
