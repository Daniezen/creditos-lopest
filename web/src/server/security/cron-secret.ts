import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Single authority for checking the shared secrets machine callers (n8n)
 * present to the `/api/cron/*` endpoints.
 *
 * Each endpoint keeps its own header contract — `Authorization: Bearer` for
 * the overdue-quotas job, `x-cron-secret` for the document sync — but both
 * decide equality here, so the comparison is constant-time everywhere and is
 * never re-implemented with `===` in a route.
 */

/**
 * Hashing both sides first gives two 32-byte buffers regardless of input
 * length, so `timingSafeEqual` never throws on a length mismatch and the
 * response time does not reveal the expected secret's length either.
 */
function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time equality between a presented secret and the configured one.
 *
 * Fails closed: an unset/empty expected secret or a missing/empty provided
 * value is never a match, so a misconfigured environment cannot open the
 * endpoint to callers that send an empty header.
 */
export function secretsMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected || !provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

const BEARER_PREFIX = "Bearer ";

/**
 * Extracts the token from an `Authorization: Bearer <token>` header.
 *
 * The scheme match is exact and case-sensitive on purpose: it preserves the
 * contract the route had before (`header === "Bearer " + secret`), which is
 * the exact string n8n is configured to send.
 */
export function readBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) return null;
  return authorizationHeader.slice(BEARER_PREFIX.length);
}
