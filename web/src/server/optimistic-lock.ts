/**
 * Optimistic lock on `actualizadoEn`, matched by millisecond rather than by
 * equality. Ported from plataforma-impulsa (`src/server/optimistic-lock.ts`).
 *
 * HOW THE LOCK WORKS. A form reads a row, sends `actualizadoEn.toISOString()`
 * to the browser and posts it back as "the version I was editing". The service
 * then *claims* the row inside its transaction:
 *
 *   const claimed = await tx.credito.updateMany({
 *     where: { id, actualizadoEn: updatedAtMatches(expected) },
 *     data: { accionPor: user.id },   // any write: Prisma bumps @updatedAt
 *   });
 *   assertVersionClaimed(claimed.count);
 *
 * The claim is a single UPDATE, so PostgreSQL takes the row lock while
 * checking the version. A concurrent transaction claiming the same row waits
 * for the first to commit, re-evaluates its WHERE against the new row (READ
 * COMMITTED re-check), sees a newer `actualizadoEn`, updates nothing and
 * reports the conflict. There is no window between "check" and "write".
 *
 * WHY EQUALITY IS NOT USED. In Impulsa every timestamp is TIMESTAMPTZ(6): rows
 * written by SQL (`now()` in a migration) keep microseconds the browser never
 * receives, so `actualizadoEn = <ms value>` matches nothing and the row becomes
 * permanently uneditable. Lopest's columns are `TIMESTAMP(3)` (Prisma's
 * default; see the init migration), so PostgreSQL itself rounds to
 * milliseconds and equality would work today. The interval is kept anyway: it
 * costs nothing, and it keeps the lock correct if a column is ever widened to
 * `@db.Timestamptz(6)` or a row is written with sub-millisecond precision by a
 * script. `optimistic-lock.contract.test.ts` rejects equality filters on
 * `actualizadoEn` so the trap cannot come back unnoticed.
 *
 * WHAT THE INTERVAL KEEPS. `[expected, expected + 1 ms)` contains exactly the
 * stored values that truncate to what the client saw. Any real write after the
 * read moves `actualizadoEn` forward by at least a millisecond, so the guarantee
 * that matters (the row has not changed since it was read) holds.
 */
export function updatedAtMatches(expected: Date): { gte: Date; lt: Date } {
  const from = new Date(expected.getTime());
  if (Number.isNaN(from.getTime())) {
    // An invalid Date would build an interval that matches nothing and turn a
    // malformed request into a phantom concurrency error; fail loudly instead.
    throw new RangeError("updatedAtMatches: the expected timestamp is not a valid date.");
  }
  return { gte: from, lt: new Date(from.getTime() + 1) };
}

/** Message shown to the person whose edit lost the race. */
export const CONCURRENT_MODIFICATION_MESSAGE =
  "Otro usuario modificó este registro mientras lo editabas. Recarga la página para ver los cambios y vuelve a intentarlo.";

/**
 * Raised when the row changed after the form read it. It aborts the
 * surrounding transaction, so nothing of the stale edit is written; the
 * actions turn its message into the form error.
 */
export class ConcurrentModificationError extends Error {
  constructor() {
    super(CONCURRENT_MODIFICATION_MESSAGE);
    this.name = "ConcurrentModificationError";
  }
}

/**
 * Throws `ConcurrentModificationError` unless the claim updated exactly one
 * row. Callers that must distinguish "row deleted" from "row changed" check
 * existence before claiming; for the edits guarded here the access check
 * (`requireCreditoAccess` / `requireClienteAccess`) already proved the row
 * exists, so zero rows means a newer version.
 */
export function assertVersionClaimed(count: number): void {
  if (count !== 1) throw new ConcurrentModificationError();
}
