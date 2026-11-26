import type { EquationRow, EquationTerm } from "../types";

/**
 * The phone's shorter reading of a month equation (`TableroMovil.dc.html`):
 * the same totals in fewer lines, because a phone card has room for four or
 * five rows, not seven boxes.
 *
 *   - A subtracted or added term that is zero this month is left out
 *     («− Perdidos $ 0»): it changes nothing in the result.
 *   - The house's «Fijos» and «Variables» read as one «Gastado» line (the
 *     canvas' wording); the desktop boxes keep them apart.
 *   - The first term and every result always stay, even when zero, so the
 *     card never loses its start or its answers.
 * Results are copied from the row, never recomputed here.
 */
export function compactTerms(row: EquationRow): EquationTerm[] {
  let terms = row.terms;
  if (row.identity === "casa") {
    const fixed = terms.find((t) => t.label === "Fijos");
    const variable = terms.find((t) => t.label === "Variables");
    if (fixed && variable) {
      const merged: EquationTerm = { op: "−", label: "Gastado", amount: fixed.amount + variable.amount };
      terms = terms.flatMap((t) => (t === fixed ? [merged] : t === variable ? [] : [t]));
    }
  }
  return terms.filter((t, index) => index === 0 || t.result || t.amount !== 0);
}
