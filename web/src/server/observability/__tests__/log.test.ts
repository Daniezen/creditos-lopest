import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildLogLine, scrubText } from "../log";

/**
 * Structured logging without secrets. Two guarantees: anything named or shaped
 * like a secret (or like client personal data) never leaves the process, and
 * nobody in `src/` writes to the console except `logEvent`.
 */

const NOW = new Date("2026-11-25T12:00:00.000Z");
const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function parse(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("buildLogLine", () => {
  it("writes one JSON line with event, level and correlation fields", () => {
    const line = parse(buildLogLine("warn", "credito.creacion_fallida", { creditoId: "c-1", clienteId: "k-1", intentos: 2 }, undefined, NOW));
    expect(line).toEqual({ ts: "2026-11-25T12:00:00.000Z", nivel: "warn", evento: "credito.creacion_fallida", creditoId: "c-1", clienteId: "k-1", intentos: 2 });
  });

  it("omits secret-named and personal-data fields whatever their value", () => {
    const fields = {
      authorization: "Bearer x",
      "x-cron-secret": "abc",
      refreshToken: "abc",
      password: "abc",
      cookieValue: "abc",
      body: "{}",
      carpetaUrl: "https://drive.google.com/x",
      cedula: "123",
      emailCliente: "a@b.co",
      telefono: "300",
      nombreCliente: "Ana",
      direccion: "Calle 1",
    };
    const line = parse(buildLogLine("error", "prueba", { ...fields, abonoEventoId: "se-conserva" }));
    for (const campo of Object.keys(fields)) expect(line[campo], campo).toBe("[omitido]");
    expect(line.abonoEventoId).toBe("se-conserva");
  });

  it("scrubs recognisable tokens from text and errors", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJh";
    expect(scrubText(`Authorization: Bearer ${jwt}`)).toBe("Authorization: [omitido]");
    expect(scrubText(`token ${jwt} final`)).toBe("token [omitido] final");
    expect(scrubText("https://n8n/x?code=SECRETO&otro=1")).toBe("https://n8n/x?code=[omitido]&otro=1");
    expect(scrubText("connect postgresql://lopest_app_user:s3cr3t@lopest_db:5432/x")).toBe(
      "connect postgresql://lopest_app_user:[omitido]@lopest_db:5432/x",
    );

    const error = Object.assign(new Error(`fallo con Bearer ${jwt}`), { code: "P2002" });
    const logged = parse(buildLogLine("error", "drive.carga_documento_fallida", {}, error)).error as Record<string, string>;
    expect(logged.nombre).toBe("Error");
    expect(logged.codigo).toBe("P2002");
    expect(logged.mensaje).toBe("fallo con [omitido]");
    expect(logged.traza).not.toContain(jwt);
  });

  it("does not let a field overwrite ts, nivel or evento", () => {
    const line = parse(buildLogLine("info", "real", { evento: "falso", nivel: "falso" }, undefined, NOW));
    expect(line.evento).toBe("real");
    expect(line.nivel).toBe("info");
  });
});

describe("console discipline", () => {
  /**
   * `app/api/cron/**` is excluded TEMPORARILY: a parallel branch is rewriting
   * those two route handlers, and editing them here would conflict. When that
   * branch lands, replace their `console.error` calls with `logEvent` and
   * delete this exclusion so the guard covers the whole tree.
   */
  const TEMPORARILY_EXCLUDED = /^app\/api\/cron\//;

  it("no file under src/ writes to the console outside logEvent", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "generated" || entry === "node_modules") continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(?:ts|tsx|mts)$/.test(entry)) {
          const rel = path.relative(SRC_DIR, full).split(path.sep).join("/");
          if (rel === "server/observability/log.ts" || TEMPORARILY_EXCLUDED.test(rel)) continue;
          if (/\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(/.test(readFileSync(full, "utf8"))) offenders.push(rel);
        }
      }
    };
    walk(SRC_DIR);
    expect(offenders, "Use logEvent (src/server/observability/log.ts)").toEqual([]);
  });
});
