import { formatMillions } from "../shared/format";
import type { MoneyPathData } from "../types";

/**
 * Geometry of «Por dónde pasó la plata» (`Main.dc.html`). Every width is a
 * share of what entered the business (step 1), so the three bars line up:
 * step 3 starts under the «A la casa» part of step 2 and is exactly as wide,
 * and the teal arrow drops from the centre of that part.
 */

export type PathSwatch =
  | "ink"
  | "ink-soft"
  | "ink-faint"
  | "ink-line"
  | "track"
  | "casa"
  | "casa-soft"
  | "ahorro";

export type PathTone = "ink" | "casa" | "ahorro" | "problem";

export interface PathPart {
  key: string;
  label: string;
  amount: number;
  /** Flex weight of the part inside its bar (proportional to the amount). */
  weight: number;
  swatch: PathSwatch;
  tone: PathTone;
  /** Parts under the label threshold keep their colour but not their caption. */
  showLabel: boolean;
}

export interface PathStep {
  n: number;
  title: string;
  total: number;
  note?: string;
  /** A note is quiet unless the house spent more than it received. */
  noteTone?: "quiet" | "problem";
  offsetPct: number;
  widthPct: number;
  parts: PathPart[];
  arrow: { atPct: number; tone: "faint" | "casa" } | null;
}

/** Captions appear on parts of at least this share of what entered (the canvas' 0,8 M of 16 M). */
export const LABEL_SHARE = 0.05;

export function moneyPathSteps({ entered, left, house }: MoneyPathData): PathStep[] {
  const contributions = entered.contributions ?? 0;
  const fromBefore = entered.fromBefore ?? 0;
  const base = entered.interest + entered.capitalReturned + contributions + fromBefore;
  const share = (amount: number) => (base > 0 ? Math.max(amount, 0) / base : 0);
  const part = (key: string, label: string, amount: number, swatch: PathSwatch, tone: PathTone = "ink"): PathPart => ({
    key,
    label,
    amount,
    weight: Math.round(share(Math.abs(amount)) * 10000),
    swatch,
    tone,
    showLabel: share(Math.abs(amount)) >= LABEL_SHARE,
  });
  const nonZero = (parts: PathPart[]) => parts.filter((p) => p.amount !== 0);

  const beforeHouse = left.newLoans + left.expenses;
  const overspent = house.surplus < 0 ? -house.surplus : 0;
  const offsetPct = share(beforeHouse) * 100;
  // What the house used: what it received, or more when it overspent.
  const widthPct = Math.min(share(house.fixed + house.variable + Math.max(house.surplus, 0)) * 100, 100 - offsetPct);

  return [
    {
      n: 1,
      title: "Entró al negocio",
      total: base,
      offsetPct: 0,
      widthPct: 100,
      parts: nonZero([
        part("intereses", "Intereses", entered.interest, "ink"),
        part("capital", "Capital que devolvieron", entered.capitalReturned, "ink-soft"),
        part("aportes", "Aportes", contributions, "ink-faint"),
        part("habia", "De lo que había", fromBefore, "track"),
      ]),
      arrow: { atPct: 50, tone: "faint" },
    },
    {
      n: 2,
      title: "Salió del negocio",
      total: left.newLoans + left.expenses + left.toHouse + left.remained,
      note: left.expenses > 0 ? `Incluye gastos por ${formatMillions(left.expenses)}` : undefined,
      offsetPct: 0,
      widthPct: 100,
      parts: nonZero([
        part("prestamos", "Préstamos nuevos", left.newLoans, "ink-faint"),
        part("gastos", "Gastos", left.expenses, "ink-line"),
        part("casa", "A la casa", left.toHouse, "casa", "casa"),
        part("quedo", "Quedó en las cuentas", left.remained, "track"),
      ]),
      arrow: { atPct: share(beforeHouse + left.toHouse / 2) * 100, tone: "casa" },
    },
    {
      n: 3,
      title: "Se usó en la casa",
      total: left.toHouse,
      note: overspent > 0 ? `Faltaron ${formatMillions(overspent)}` : undefined,
      noteTone: overspent > 0 ? "problem" : undefined,
      offsetPct,
      widthPct,
      parts: nonZero([
        part("fijos", "Fijos", house.fixed, "casa", "casa"),
        part("variables", "Variables", house.variable, "casa-soft", "casa"),
        part("sobra", "Sobra", Math.max(house.surplus, 0), "ahorro", "ahorro"),
      ]),
      arrow: null,
    },
  ];
}
