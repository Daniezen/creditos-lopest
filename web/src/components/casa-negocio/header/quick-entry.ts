import type { CnIdentity, QuickEntryKind, QuickEntryOptions, QuickOption } from "../types";

/**
 * The six movement types of «Anotar» and the two selects each one needs
 * (`ModuloTabs.dc.html`). DOM-free, so the field mapping is tested on its own.
 *
 * Field names are the contract with the save action
 * (`features/casa-negocio/anotar-actions.ts`, schema in `anotar.ts`):
 * `tipo`, `operationKey`, the two names below, `monto`, `fecha`.
 */

/** Panel opened prefilled from a detail window («Pagar» a fixed expense). */
export interface QuickEntryPrefill {
  kind: QuickEntryKind;
  /** Initial value by select name (`categoria`, `cuentaOrigen`, ...). */
  values: Record<string, string>;
  /** Whole pesos as digits. */
  monto?: string;
}

/** Query parameter that opens «Anotar» prefilled: `?anotar=gastoCasa&categoria=<id>&monto=<n>`. */
export const PREFILL_PARAM = "anotar";

const PREFILL_FIELDS = ["categoria", "cuentaOrigen", "cuentaDestino", "origen", "concepto"] as const;

/**
 * Reads a prefill from query parameters (server: the page's searchParams;
 * client: a clicked «Pagar» link). Unknown kinds give null; values that are
 * not plain ids or whole amounts are dropped, never echoed into the form.
 */
export function prefillFromParams(get: (name: string) => string | null | undefined): QuickEntryPrefill | null {
  const kind = get(PREFILL_PARAM);
  if (!kind || !QUICK_ENTRY_KINDS.some((def) => def.kind === kind)) return null;
  const values: Record<string, string> = {};
  for (const name of PREFILL_FIELDS) {
    const value = get(name);
    if (value && /^[\w:.-]{1,80}$/.test(value)) values[name] = value;
  }
  const monto = get("monto");
  return { kind: kind as QuickEntryKind, values, monto: monto && /^\d{1,12}$/.test(monto) ? monto : undefined };
}

export interface QuickEntryKindDef {
  kind: QuickEntryKind;
  label: string;
  /** Identity dot; `null` is the neutral traslado. */
  identity: CnIdentity | null;
}

export const QUICK_ENTRY_KINDS: readonly QuickEntryKindDef[] = [
  { kind: "gastoCasa", label: "Gasto de la casa", identity: "casa" },
  { kind: "ingresoCasa", label: "Ingreso de la casa", identity: "casa" },
  { kind: "gastoNegocio", label: "Gasto del negocio", identity: "negocio" },
  { kind: "aporte", label: "Aporte", identity: "negocio" },
  { kind: "retiro", label: "A la casa", identity: "negocio" },
  { kind: "traslado", label: "Traslado", identity: null },
];

export interface QuickSelectField {
  name: string;
  label: string;
  options: QuickOption[];
}

export function quickEntryFields(kind: QuickEntryKind, o: QuickEntryOptions): [QuickSelectField, QuickSelectField] {
  switch (kind) {
    case "gastoCasa":
      return [
        { name: "categoria", label: "Categoría", options: o.categoriasCasa },
        { name: "cuentaOrigen", label: "Pagado desde", options: o.cuentasCasa },
      ];
    case "ingresoCasa":
      return [
        { name: "origen", label: "De dónde", options: o.origenesIngresoCasa },
        { name: "cuentaDestino", label: "Recibido en", options: o.cuentasCasa },
      ];
    case "gastoNegocio":
      return [
        { name: "concepto", label: "Concepto", options: o.conceptosNegocio },
        { name: "cuentaOrigen", label: "Pagado desde", options: o.cuentasNegocio },
      ];
    case "aporte":
      return [
        { name: "origen", label: "De dónde viene", options: o.origenesAporte },
        { name: "cuentaDestino", label: "Recibido en", options: o.cuentasNegocio },
      ];
    case "retiro":
      return [
        { name: "cuentaOrigen", label: "Sale de", options: o.cuentasNegocio },
        { name: "cuentaDestino", label: "Llega a", options: o.cuentasCasa },
      ];
    case "traslado":
      return [
        { name: "cuentaOrigen", label: "Sale de", options: o.cuentasTodas },
        { name: "cuentaDestino", label: "Llega a", options: o.cuentasTodas },
      ];
  }
}
