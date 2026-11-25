/**
 * Contract for the optimistic lock on `actualizadoEn`. Ported from
 * plataforma-impulsa (`optimistic-lock.contract.test.mjs`, 05-oct-2026).
 *
 * WHY THIS FILE EXISTS. In Impulsa an equality filter on `updated_at` made 16
 * rows permanently uneditable: their TIMESTAMPTZ(6) values, written by SQL
 * `now()`, carried microseconds a JavaScript Date cannot echo back. Lopest's
 * columns are TIMESTAMP(3) today, so the defect is latent rather than live,
 * but the same filter would reappear silently the day a column is widened.
 * This test keeps `updatedAtMatches()` the only way to guard a write.
 *
 * Lopest's services live in `src/features/**` (actions) as well as
 * `src/server/**`, so both trees are scanned.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assertVersionClaimed, ConcurrentModificationError, updatedAtMatches } from "./optimistic-lock";

const read = (file: string) => fs.readFileSync(file, "utf8");

/** Every `.ts` under `dir`, tests aside. */
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(full);
    return entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

/**
 * The text of each `where: { … }` object, read by balancing braces: a lock
 * often sits on its own line inside a multi-line `where`, which a one-line
 * regex misses.
 */
function whereObjects(source: string): string[] {
  const found: string[] = [];
  const marker = /where:\s*\{/g;
  for (let match = marker.exec(source); match; match = marker.exec(source)) {
    let depth = 0;
    for (let cursor = match.index + match[0].length - 1; cursor < source.length; cursor += 1) {
      if (source[cursor] === "{") depth += 1;
      else if (source[cursor] === "}") {
        depth -= 1;
        if (depth === 0) {
          found.push(source.slice(match.index, cursor + 1));
          break;
        }
      }
    }
  }
  return found;
}

describe("updatedAtMatches", () => {
  it("matches a stored value with microseconds against what the client saw", () => {
    // `…17.633922` stored, `…17.633` echoed back by the browser.
    const seen = new Date("2026-08-24T21:57:17.633Z");
    const { gte, lt } = updatedAtMatches(seen);
    const storedMicros = seen.getTime() + 0.922; // the 922 µs the Date dropped
    expect(storedMicros >= gte.getTime() && storedMicros < lt.getTime()).toBe(true);
  });

  it("leaves a later write outside the interval", () => {
    const seen = new Date("2026-08-24T21:57:17.633Z");
    const { lt } = updatedAtMatches(seen);
    // The next millisecond is already a different version of the row.
    expect(lt.getTime()).toBe(seen.getTime() + 1);
  });

  it("does not alias the caller's Date", () => {
    const seen = new Date("2026-10-05T12:00:00.000Z");
    const { gte } = updatedAtMatches(seen);
    expect(gte).not.toBe(seen);
    expect(gte.getTime()).toBe(seen.getTime());
  });

  it("fails loudly on an invalid timestamp instead of reporting a phantom conflict", () => {
    expect(() => updatedAtMatches(new Date("not a date"))).toThrow(RangeError);
  });

  it("turns a lost claim into the user-facing conflict error", () => {
    expect(() => assertVersionClaimed(1)).not.toThrow();
    expect(() => assertVersionClaimed(0)).toThrow(ConcurrentModificationError);
    expect(() => assertVersionClaimed(0)).toThrow(/Otro usuario modificó este registro/);
  });
});

describe("optimistic lock contract", () => {
  it("never guards a write with actualizadoEn equality under src/server or src/features", () => {
    const offenders: string[] = [];
    for (const file of [...sources("src/server"), ...sources("src/features")]) {
      if (file.endsWith("optimistic-lock.ts")) continue;
      for (const where of whereObjects(read(file))) {
        // `actualizadoEn: { lt: cutoff }` and friends are range queries, not
        // locks; anything else that is not the shared interval is equality.
        for (const value of where.matchAll(/\bactualizadoEn\s*:\s*([^,}\n]+)/g)) {
          const expression = value[1].trim();
          if (expression.startsWith("{") || expression.startsWith("updatedAtMatches(")) continue;
          offenders.push(`${file}: actualizadoEn: ${expression}`);
        }
      }
    }
    expect(offenders, `Bloqueo por igualdad de actualizadoEn; use updatedAtMatches():\n${offenders.join("\n")}`).toEqual([]);
  });

  it("guards the four concurrent edits with the shared interval", () => {
    const expected: Record<string, number> = {
      // Credit edit (conditions/notes).
      "src/features/creditos/editar/actions.ts": 1,
      // Client edit.
      "src/features/clientes/actions.ts": 1,
      // Abono registration (claims the credit row).
      "src/features/creditos/abonos/actions.ts": 1,
      // Term extension and its reversal (both claim the credit row).
      "src/features/creditos/plazos/actions.ts": 2,
    };
    for (const [file, count] of Object.entries(expected)) {
      const source = read(file);
      expect(source, file).toMatch(/import \{[^}]*\bupdatedAtMatches\b[^}]*\} from "@\/server\/optimistic-lock";/);
      expect(source.match(/actualizadoEn: updatedAtMatches\(/g)?.length ?? 0, file).toBe(count);
    }
  });
});
