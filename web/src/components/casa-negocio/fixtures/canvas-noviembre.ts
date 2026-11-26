import type { ModuleHeaderProps } from "../header/module-header";
import type { CasaNegocioTab } from "../header/tabs";
import { CASA_NEGOCIO_HREF } from "../shell/rail-items";
import type { TableroData } from "../tablero/tablero";
import type { MonthLineData, QuickEntryOptions } from "../types";

/**
 * DEMO DATA, not real money: the example of the approved canvas
 * (`Main.dc.html`, `ModuloTabs.dc.html`, `TableroMovil.dc.html`), November
 * 2026 seen on the 25th. It fills the components until the data and engine
 * layers are wired in; then each page replaces `demoHeader`/`demoTablero`
 * with its real loaders and this file goes away.
 *
 * Canvas links to other artboards are mapped to the module's routes.
 */

const HREF = {
  casa: `${CASA_NEGOCIO_HREF}/casa`,
  ahorro: `${CASA_NEGOCIO_HREF}/ahorro`,
  arqueo: `${CASA_NEGOCIO_HREF}/arqueo`,
  creditos: "/creditos",
} as const;

const line: MonthLineData = {
  daysInMonth: 30,
  today: 25,
  period: "actual",
  monthName: "noviembre",
  summary:
    "Noviembre: pagados Davivienda, Arriendo e Internet; sin pagar Funeraria y Seguros Bolo; retiros a la casa el 1 y el 24; hoy es 25; cierre el 30",
  marks: [
    { id: "retiro-1", day: 1, kind: "entrada", label: "Retiro +3,0 M", title: "Retiro a la casa", detail: "$ 3.000.000 · Bancolombia → Cuenta casa" },
    { id: "davivienda", day: 16, kind: "pagado", label: "Davivienda", title: "Crédito Davivienda", detail: "$ 820.000 · pagado el 16" },
    {
      id: "funeraria",
      day: 16,
      kind: "vencido",
      label: "Funeraria",
      title: "Funeraria",
      detail: "$ 32.000 · sin pagar desde el 16",
      action: { label: "Pagar", href: HREF.casa },
    },
    { id: "arriendo", day: 17, kind: "pagado", label: "Arriendo", title: "Arriendo", detail: "$ 1.787.000 · pagado el 17" },
    { id: "internet", day: 20, kind: "pagado", label: "Internet", title: "Internet y TV", detail: "$ 120.000 · pagado el 20" },
    {
      id: "seguros",
      day: 20,
      kind: "vencido",
      label: "Seguros Bolo",
      title: "Seguros Bolo",
      detail: "$ 170.000 · sin pagar desde el 20",
      action: { label: "Pagar", href: HREF.casa },
    },
    { id: "retiro-24", day: 24, kind: "entrada", label: "Retiro +2,5 M", title: "Retiro a la casa", detail: "$ 2.500.000 · Bancolombia → Cuenta casa" },
    {
      id: "cobros-25",
      day: 25,
      kind: "viene",
      label: "5 cobros",
      title: "5 cuotas por cobrar hoy",
      detail: "$ 1.720.000 entre 5 clientes",
      action: { label: "Ver cuotas", href: HREF.creditos },
    },
    { id: "cobros-27", day: 27, kind: "viene", label: "2 cobros", title: "2 cuotas por cobrar", detail: "$ 600.000" },
    {
      id: "cierre",
      day: 30,
      kind: "cierre",
      label: "Cierre",
      title: "Cierre de noviembre",
      detail: "Pasar lo que sobre al ahorro · hoy serían $ 631.000",
      action: { label: "Ir a Ahorro", href: HREF.ahorro },
    },
  ],
};

const opt = (label: string) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label });
const cuentasNegocio = ["Bancolombia", "Efectivo", "Nequi"].map(opt);
const cuentasCasa = ["Cuenta casa", "Nu · ahorro"].map(opt);

const quickEntryOptions: QuickEntryOptions = {
  categoriasCasa: ["Mercado", "Seguros Bolo · sin pagar", "Funeraria · sin pagar", "Gasolina"].map(opt),
  origenesIngresoCasa: ["Arriendo recibido", "Regalo", "Otro"].map(opt),
  conceptosNegocio: ["Papelería", "Transporte", "Comisiones", "Otro"].map(opt),
  origenesAporte: ["Ahorros propios", "Otro"].map(opt),
  cuentasNegocio,
  cuentasCasa,
  cuentasTodas: [...cuentasNegocio, ...cuentasCasa],
  saldos: { bancolombia: 11_900_000, efectivo: 1_320_000, nequi: 1_600_000, "cuenta-casa": 833_000, "nu-ahorro": 7_006_000 },
  nombresCuenta: Object.fromEntries([...cuentasNegocio, ...cuentasCasa].map((o) => [o.value, o.label])),
  avisoSinSaldo: true,
};

/** Header of any tab, as on the canvas. No save action: «Guardar» stays disabled in the demo. */
export function demoHeader(active: CasaNegocioTab): ModuleHeaderProps {
  return {
    active,
    month: {
      title: "Noviembre",
      year: "2026",
      prevHref: `${CASA_NEGOCIO_HREF}?mes=2026-10`,
      nextHref: `${CASA_NEGOCIO_HREF}?mes=2026-12`,
    },
    line,
    readOnly: false,
    quickEntry: { options: quickEntryOptions, defaultDate: "2026-11-25", prefill: null, cleanHref: CASA_NEGOCIO_HREF },
    summary: active === "tablero" ? { total: "$ 22.659.000", detail: "en cuentas · $ 186,4 M en la calle" } : undefined,
  };
}

/** The canvas opens the 20th in the calendar to show its detail window. */
export const DEMO_CALENDAR_OPEN_DAY = 20;

export const demoTablero: TableroData = {
  next: { title: "Pagar Seguros Bolo", detail: "$ 170.000 · venció el 20", href: HREF.casa, more: 3 },
  moneyPath: {
    entered: { interest: 6_240_000, capitalReturned: 9_800_000 },
    left: { newLoans: 3_000_000, expenses: 180_000, toHouse: 5_500_000, remained: 7_360_000 },
    house: { fixed: 2_727_000, variable: 1_940_000, surplus: 833_000 },
  },
  calendar: {
    year: 2026,
    month: 11,
    monthTitle: "Noviembre",
    monthName: "noviembre",
    today: 25,
    days: {
      1: [
        { kind: "cobro", text: "6 cuotas cobradas · $ 2.140.000" },
        { kind: "casa", text: "Retiro a la casa · $ 3.000.000" },
      ],
      5: [{ kind: "cobro", text: "4 cuotas cobradas · $ 1.380.000" }],
      10: [{ kind: "cobro", text: "7 cuotas cobradas · $ 2.600.000" }],
      15: [{ kind: "cobro", text: "5 cuotas cobradas · $ 1.910.000" }],
      16: [
        { kind: "casa", text: "Crédito Davivienda · pagado" },
        { kind: "falta", text: "Funeraria · $ 32.000", action: { label: "Pagar", href: HREF.casa } },
      ],
      17: [{ kind: "casa", text: "Arriendo · pagado" }],
      20: [
        { kind: "cobro", text: "5 de 6 cuotas cobradas" },
        { kind: "casa", text: "Internet y TV · pagado" },
        { kind: "falta", text: "Seguros Bolo · $ 170.000", action: { label: "Pagar", href: HREF.casa } },
      ],
      24: [{ kind: "casa", text: "Retiro a la casa · $ 2.500.000" }],
      25: [
        { kind: "cobro", text: "5 cuotas por cobrar · $ 1.720.000", action: { label: "Ver", href: HREF.creditos } },
        { kind: "falta", text: "Bancolombia sin contar hace 9 días", action: { label: "Contar", href: HREF.arqueo } },
      ],
      30: [
        { kind: "cobro", text: "4 cuotas por cobrar · $ 1.430.000" },
        { kind: "ahorro", text: "Pasar lo que sobre al ahorro · $ 631.000", action: { label: "Ahorrar", href: HREF.ahorro } },
      ],
    },
  },
  equations: [
    {
      name: "Negocio",
      identity: "negocio",
      terms: [
        { op: "", label: "Intereses", amount: 6_240_000 },
        { op: "−", label: "Gastos", amount: 180_000 },
        { op: "−", label: "Perdidos", amount: 0 },
        { op: "=", label: "Ganancia", amount: 6_060_000, result: true },
        { op: "−", label: "A la casa", amount: 5_500_000 },
        { op: "=", label: "Reinvertido", amount: 560_000, result: true },
      ],
    },
    {
      name: "Casa",
      identity: "casa",
      terms: [
        { op: "", label: "Entró", amount: 5_500_000 },
        { op: "−", label: "Fijos", amount: 2_727_000 },
        { op: "−", label: "Variables", amount: 1_940_000 },
        { op: "=", label: "Hoy", amount: 833_000, result: true },
        { op: "−", label: "Fijos sin pagar", amount: 202_000 },
        { op: "=", label: "Al cierre", amount: 631_000, result: true },
      ],
      notices: [{ level: "atencion", text: "Si se gasta lo que queda en los sobres, noviembre cierra en −$ 1.499.000." }],
    },
  ],
  money: {
    total: 22_659_000,
    accounts: [
      { id: "bancolombia", name: "Bancolombia", balance: 11_900_000, swatch: "ink", status: { text: "Sin contar hace 9 días", tone: "neutral" } },
      { id: "nu", name: "Nu · ahorro", balance: 7_006_000, swatch: "ahorro", status: { text: "Cuadra", tone: "ok" } },
      { id: "nequi", name: "Nequi", balance: 1_600_000, swatch: "ink-soft", status: { text: "Faltan $ 50.000", tone: "problema" } },
      { id: "efectivo", name: "Efectivo", balance: 1_320_000, swatch: "ink-faint", status: { text: "Cuadra", tone: "ok" } },
      { id: "casa", name: "Cuenta casa", balance: 833_000, swatch: "casa", status: { text: "Cuadra", tone: "ok" } },
    ],
  },
  street: {
    amount: 186_400_000,
    activeCredits: 42,
    stale: { text: "3 créditos sin pagos hace más de 90 días · $ 8,4 M", href: HREF.creditos },
  },
  envelopes: [
    { id: "mercado", name: "Mercado", spent: 1_210_000, cap: 2_700_000 },
    { id: "epm", name: "EPM", spent: 312_000, cap: 470_000 },
    { id: "gasolina", name: "Gasolina", spent: 186_000, cap: 200_000 },
    { id: "salud", name: "Salud", spent: 72_000, cap: 50_000 },
    { id: "entretenimiento", name: "Entretenimiento", spent: 60_000, cap: 150_000 },
    { id: "imprevistos", name: "Imprevistos", spent: 100_000, cap: 500_000 },
  ],
};
