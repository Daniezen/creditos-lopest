import type { Pesos } from "./inputs";

/**
 * Spanish short-text formatting used by agenda and avisos.
 *
 * Grouping is done by hand instead of `toLocaleString("es-CO")` on purpose: the `es`
 * CLDR data uses minimumGroupingDigits = 2, so 5000 renders as "5000" while 50000 renders
 * as "50.000", and the output can also vary with the ICU build of the runtime. The canvas
 * always groups ("$ 32.000"), so a deterministic formatter keeps tests and UI identical.
 * The minus sign is U+2212, as in the canvas ("−$ 1.499.000").
 */
function agrupar(entero: number): string {
  return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "$ 1.787.000" / "−$ 1.499.000". */
export function pesos(n: Pesos): string {
  return (n < 0 ? "−$ " : "$ ") + agrupar(Math.abs(n));
}

/**
 * Millions with one decimal and a comma: 3_000_000 → "3,0 M", 8_400_000 → "8,4 M".
 * Rounds half away from zero on the tenth using integer math (no float drift).
 */
export function millones(n: Pesos): string {
  const decimas = Math.round(Math.abs(n) / 100_000);
  const texto = `${agrupar(Math.floor(decimas / 10))},${decimas % 10} M`;
  return n < 0 ? `−${texto}` : texto;
}

/** "1 crédito" / "3 créditos". */
export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
