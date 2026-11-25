/**
 * Presentational contracts of the Casa y Negocio components.
 *
 * These are view models, not domain models: amounts are plain numbers of
 * Colombian pesos, texts arrive already worded, and nothing here queries
 * anything. The data and engine layers (built in parallel) map their results
 * onto these shapes; until then `fixtures/tablero.ts` fills them with the
 * canvas example.
 */

/** Whose money a thing is. Negocio is ink, Casa teal, Ahorro gold. */
export type CnIdentity = "negocio" | "casa" | "ahorro";

/** The two notice levels of spec §5: attention (amber) and problem (red). */
export type NoticeLevel = "atencion" | "problema";

/** A link that does something about what is shown («Pagar», «Contar»). */
export interface CnAction {
  label: string;
  href: string;
}

/* ------------------------------------------------------------------ */
/* Header: month line                                                  */
/* ------------------------------------------------------------------ */

/**
 * - `pagado`: done (filled ink).
 * - `vencido`: its date passed unpaid (red ring).
 * - `entrada`: money that came in to the house (teal square).
 * - `viene`: still to come (hollow).
 * - `cierre`: the month's close; always drawn on the last day.
 */
export type MonthMarkKind = "pagado" | "vencido" | "entrada" | "viene" | "cierre";

export interface MonthMark {
  /** Stable key (the source record's id). */
  id: string;
  /** Day of the month, 1-based. Ignored for `cierre`, which sits on the last day. */
  day: number;
  kind: MonthMarkKind;
  /** Short text under the mark: «Arriendo», «Retiro +3,0 M». */
  label: string;
  /** Title of the detail window and accessible name of the mark. */
  title: string;
  /** One line of detail: «$ 1.787.000 · pagado el 17». */
  detail: string;
  /** What to do about it; hidden in read-only mode. */
  action?: CnAction;
}

export interface MonthLineData {
  daysInMonth: number;
  /** Today's day when the month shown is the current one; null otherwise. */
  today: number | null;
  /** When `today` is null: a closed month is drawn full, a future one empty. */
  period: "pasado" | "actual" | "futuro";
  /** Month name in lower case, for dates in the detail window: «noviembre». */
  monthName: string;
  marks: MonthMark[];
  /** One sentence describing the whole line, for assistive technology. */
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Header: quick entry («Anotar»)                                      */
/* ------------------------------------------------------------------ */

/** The six movement types of the quick panel (spec §3). */
export type QuickEntryKind = "gastoCasa" | "ingresoCasa" | "gastoNegocio" | "aporte" | "retiro" | "traslado";

export interface QuickOption {
  value: string;
  label: string;
}

/** Choices the quick panel offers; each type draws its two selects from these. */
export interface QuickEntryOptions {
  categoriasCasa: QuickOption[];
  origenesIngresoCasa: QuickOption[];
  conceptosNegocio: QuickOption[];
  origenesAporte: QuickOption[];
  cuentasNegocio: QuickOption[];
  cuentasCasa: QuickOption[];
}

/* ------------------------------------------------------------------ */
/* Tablero                                                             */
/* ------------------------------------------------------------------ */

/** «Por dónde pasó la plata»: the month's money in three steps. */
export interface MoneyPathData {
  /** Step 1, what entered the business. */
  entered: { interest: number; capitalReturned: number };
  /** Step 2, where it went: the four parts add up to step 1. */
  left: { newLoans: number; expenses: number; toHouse: number; remained: number };
  /** Step 3, how the house used what it received (`toHouse`). Surplus may be negative. */
  house: { fixed: number; variable: number; surplus: number };
}

/** What a day holds in the compact calendar. */
export type CalendarEventKind = "cobro" | "casa" | "falta" | "ahorro";

export interface CalendarEvent {
  kind: CalendarEventKind;
  text: string;
  action?: CnAction;
}

export interface MonthCalendarData {
  year: number;
  /** 1-12. */
  month: number;
  /** Capitalised month name for the card title: «Noviembre». */
  monthTitle: string;
  monthName: string;
  today: number | null;
  /** Events by day of month. Days without events cannot be opened. */
  days: Record<number, CalendarEvent[]>;
}

export type EquationOperator = "" | "+" | "−" | "=";

export interface EquationTerm {
  op: EquationOperator;
  label: string;
  amount: number;
  /** Results (after «=») are drawn on ink. */
  result?: boolean;
}

export interface EquationRow {
  name: string;
  identity: CnIdentity;
  terms: EquationTerm[];
  notice?: { level: NoticeLevel; text: string };
}

/** Swatch of an account in «Dónde está la plata»; ink shades are business accounts. */
export type AccountSwatch = "ink" | "ink-soft" | "ink-faint" | "casa" | "casa-soft" | "ahorro";

export interface AccountBalance {
  id: string;
  name: string;
  balance: number;
  swatch: AccountSwatch;
  /** Count status: «Cuadra», «Sin contar hace 9 días», «Faltan $ 50.000». */
  status: { text: string; tone: "neutral" | "ok" | "atencion" | "problema" };
}

export interface StreetData {
  /** Capital outstanding (cartera). Shown apart, never added to the family's money. */
  amount: number;
  activeCredits: number;
  /** Credits without payments for a while (notice 8). */
  stale?: { text: string; href: string };
}

export interface Envelope {
  id: string;
  name: string;
  spent: number;
  cap: number;
}

/** Mobile Tablero: the most urgent thing to do, first. */
export interface NextActionData {
  title: string;
  detail: string;
  href: string;
  /** How many more things wait after this one. */
  more: number;
}
