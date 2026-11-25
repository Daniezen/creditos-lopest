/**
 * State of a house envelope («sobre»): fine, near its cap (spec §5 notice 2,
 * default 90 %, attention) or past it (problem). A cap of zero with spending
 * is past it; with no spending it is fine.
 */
export type EnvelopeState = "ok" | "cerca" | "pasado";

export const DEFAULT_NEAR_SHARE = 0.9;

export function envelopeState(spent: number, cap: number, nearShare = DEFAULT_NEAR_SHARE): EnvelopeState {
  if (cap <= 0) return spent > 0 ? "pasado" : "ok";
  const used = spent / cap;
  if (used > 1) return "pasado";
  if (used >= nearShare) return "cerca";
  return "ok";
}

/** Width of the spent bar, in whole percent, never past the card. */
export function envelopeFillPct(spent: number, cap: number): number {
  if (cap <= 0) return spent > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round((spent / cap) * 100)));
}
