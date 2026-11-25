/**
 * Money arithmetic for the module, in integer cents.
 *
 * Balances add hundreds of Decimal(18, 2) values. Summing them as JS floats
 * (`0.1 + 0.2`) can leave a residue that makes an arqueo "not match" by
 * 0.0000001; converting every amount to integer cents first keeps every sum
 * exact (cents stay far below Number.MAX_SAFE_INTEGER for any family budget)
 * and the result converts back to pesos with two decimals at most.
 *
 * Pure module: accepts Prisma.Decimal, numbers or numeric strings without
 * importing Prisma.
 */

/** Anything with a numeric `toString()`: Prisma.Decimal, number, string. */
export type Monetario = { toString(): string } | number | string | null | undefined;

/** Integer cents of an amount; null/undefined/non-numeric count as 0. */
export function aCentavos(value: Monetario): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(typeof value === "number" ? value : value.toString());
  if (!Number.isFinite(parsed)) return 0;
  // Math.round absorbs the float noise of values like 1787000.1 * 100.
  return Math.round(parsed * 100);
}

/** Pesos (number) from integer cents. */
export function aPesos(centavos: number): number {
  return centavos / 100;
}

/** Decimal string for a Prisma Decimal column (`"1787000.00"`). */
export function aDecimal(pesos: number): string {
  return aPesos(aCentavos(pesos)).toFixed(2);
}

/** Exact sum of amounts, in pesos. */
export function sumar(values: Iterable<Monetario>): number {
  let total = 0;
  for (const value of values) total += aCentavos(value);
  return aPesos(total);
}
