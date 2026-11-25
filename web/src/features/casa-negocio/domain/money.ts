import type { Pesos } from "./inputs";

/**
 * Integer-peso arithmetic for the engine.
 *
 * JavaScript numbers are exact for integers up to 2^53, far above any family balance, so
 * plain `number` is safe as long as every value entering the engine is a whole peso. The
 * guard below turns a silent float (e.g. a Prisma `Decimal` of 1500.5 converted with
 * `toNumber()`) into a loud error at the boundary instead of a drifting total later.
 */
export function assertPesos(value: number, campo = "monto"): Pesos {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${campo} debe ser un entero de pesos; llegó ${String(value)}`);
  }
  return value;
}

/** Sums integer pesos, validating every term. */
export function sumarPesos(values: readonly number[], campo = "monto"): Pesos {
  let total = 0;
  for (const value of values) total += assertPesos(value, campo);
  return total;
}

/**
 * Integer percentage floored, so "90 %" is shown only when the real share is ≥ 90 %
 * (rounding 89.6 up would contradict a level computed with exact integer math).
 * Returns null when the base is not positive (a 0 cap has no meaningful share).
 */
export function porcentajeEntero(parte: Pesos, base: Pesos): number | null {
  if (base <= 0) return null;
  return Math.floor((parte * 100) / base);
}
