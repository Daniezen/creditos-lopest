import type { CnIdentity, QuickEntryKind, QuickEntryOptions, QuickOption } from "../types";

/**
 * The six movement types of «Anotar» and the two selects each one needs
 * (`ModuloTabs.dc.html`). DOM-free, so the field mapping is tested on its own.
 *
 * Field names are the contract with the save action (a server action that
 * receives the form's FormData): `tipo`, the two names below, `monto`, `fecha`.
 */

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
        { name: "cuentaOrigen", label: "Sale de", options: o.cuentasNegocio },
        { name: "cuentaDestino", label: "Llega a", options: o.cuentasNegocio },
      ];
  }
}
