/**
 * Money as the canvas writes it: «$ 1.787.000», «−$ 1.499.000» (a true minus
 * sign, so it never reads as a hyphen) and «$ 6,2 M» for millions.
 * es-CO grouping; amounts are whole pesos.
 */

const MINUS = "−";

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? MINUS : "";
  return `${sign}$ ${Math.round(Math.abs(amount)).toLocaleString("es-CO")}`;
}

export function formatMillions(amount: number): string {
  const sign = amount < 0 ? MINUS : "";
  const millions = (Math.abs(amount) / 1e6).toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}$ ${millions} M`;
}
