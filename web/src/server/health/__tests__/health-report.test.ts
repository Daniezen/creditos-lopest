import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DRIVE_MAX_AGE_HOURS,
  HEALTH_REPORT_KEYS,
  evaluateHealth,
  readVersion,
  withTimeout,
  type HealthMeasurements,
} from "../health-report";

const NOW = new Date("2026-11-25T12:00:00.000Z");
const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function healthy(overrides: Partial<HealthMeasurements> = {}): HealthMeasurements {
  return {
    database: { ok: true, latencyMs: 4 },
    vencidas: { pendientesVencidas: 0, pendientesVencidasFueraDeTolerancia: 0, ultimaTransicionCron: new Date("2026-11-25T06:00:00.000Z") },
    drive: { ultimaVerificacion: new Date("2026-11-25T03:00:00.000Z") },
    version: { commit: "945d944", buildTime: null },
    ...overrides,
  };
}

/** Flattens an object into dot paths of its leaves. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("evaluateHealth", () => {
  it("answers 200 ok when everything is within thresholds", () => {
    const { status, report } = evaluateHealth(healthy(), NOW);
    expect(status).toBe(200);
    expect(report.estado).toBe("ok");
    expect(report.crons.driveSincronizacion.horasDesdeUltimaVerificacion).toBe(9);
  });

  it("answers 503 caido when the database does not answer, with cron state unknown", () => {
    const { status, report } = evaluateHealth(healthy({ database: { ok: false, latencyMs: 2000 }, vencidas: null, drive: null }), NOW);
    expect(status).toBe(503);
    expect(report.estado).toBe("caido");
    expect(report.crons.vencidas.ok).toBeNull();
    expect(report.crons.driveSincronizacion.ok).toBeNull();
  });

  it("stays ok while overdue installments are within the one-cycle tolerance", () => {
    const m = healthy({ vencidas: { pendientesVencidas: 3, pendientesVencidasFueraDeTolerancia: 0, ultimaTransicionCron: null } });
    expect(evaluateHealth(m, NOW).report.estado).toBe("ok");
  });

  it("degrades (still 200) when the overdue cron left a backlog older than a cycle", () => {
    const m = healthy({ vencidas: { pendientesVencidas: 5, pendientesVencidasFueraDeTolerancia: 2, ultimaTransicionCron: null } });
    const { status, report } = evaluateHealth(m, NOW);
    expect(status).toBe(200);
    expect(report.estado).toBe("degradado");
    expect(report.crons.vencidas.ok).toBe(false);
  });

  it("degrades when the latest Drive verification is too old, but not when there is none yet", () => {
    const old = new Date(NOW.getTime() - (DRIVE_MAX_AGE_HOURS + 1) * 3_600_000);
    expect(evaluateHealth(healthy({ drive: { ultimaVerificacion: old } }), NOW).report.estado).toBe("degradado");
    expect(evaluateHealth(healthy({ drive: { ultimaVerificacion: null } }), NOW).report.estado).toBe("ok");
  });

  it("exposes exactly the reviewed public shape, whatever the branch", () => {
    for (const m of [healthy(), healthy({ database: { ok: false, latencyMs: 1 }, vencidas: null, drive: null })]) {
      expect(leafPaths(evaluateHealth(m, NOW).report).sort()).toEqual([...HEALTH_REPORT_KEYS].sort());
    }
  });
});

describe("readVersion", () => {
  it("accepts only a commit hash and an ISO timestamp", () => {
    expect(readVersion({ APP_COMMIT_SHA: "945D944", APP_BUILD_TIME: "2026-11-25T10:00:00Z" })).toEqual({ commit: "945d944", buildTime: "2026-11-25T10:00:00Z" });
    expect(readVersion({ APP_COMMIT_SHA: "postgresql://u:p@h/db", APP_BUILD_TIME: "ayer" })).toEqual({ commit: null, buildTime: null });
    expect(readVersion({})).toEqual({ commit: null, buildTime: null });
  });
});

describe("withTimeout", () => {
  it("rejects when the promise is slower than the budget", async () => {
    await expect(withTimeout(new Promise((resolve) => setTimeout(resolve, 200)), 10)).rejects.toThrow("timeout");
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
  });
});

describe("n8n workflows (versioned copies, not the live instance)", () => {
  type N8nNode = { name: string; type: string; parameters?: Record<string, unknown>; credentials?: Record<string, { id: string; name: string }> };
  type Workflow = { nodes: N8nNode[]; connections: Record<string, { main: { node: string }[][] }>; settings: Record<string, unknown>; active: boolean };
  const load = (file: string) => JSON.parse(readFileSync(path.join(REPO_DIR, "n8n", file), "utf8")) as Workflow;
  const salud = load("LOPEST - Salud diaria.json");
  const errores = load("LOPEST - Alertas de errores a Telegram.json");
  const branches = (wf: Workflow, node: string) => (wf.connections[node]?.main ?? []).map((branch) => branch.map((link) => link.node));

  it("runs daily at 7:00 Bogotá, ships inactive and calls /api/salud", () => {
    const schedule = salud.nodes.find((n) => n.type === "n8n-nodes-base.scheduleTrigger");
    expect(JSON.stringify(schedule?.parameters)).toContain('"expression":"0 7 * * *"');
    expect(salud.settings.timezone).toBe("America/Bogota");
    expect(salud.active).toBe(false);
    expect(errores.active).toBe(false);
    const http = salud.nodes.find((n) => n.type === "n8n-nodes-base.httpRequest");
    expect(String(http?.parameters?.url)).toContain("/api/salud");
  });

  it("alerts by Telegram only on the failure branch, then marks the run failed", () => {
    expect(branches(salud, "IF - Falla")).toEqual([["Telegram - Avisar Falla"], []]);
    expect(branches(salud, "Telegram - Avisar Falla")).toEqual([["Stop - Marcar Falla"]]);
    expect(branches(errores, "Set - Config")).toEqual([["Telegram - Enviar alerta"]]);
  });

  it("takes the bot token from an n8n credential and the chat_id from a parameter, never inline", () => {
    for (const wf of [salud, errores]) {
      const telegram = wf.nodes.filter((n) => n.type === "n8n-nodes-base.telegram");
      expect(telegram).toHaveLength(1);
      expect(Object.keys(telegram[0].credentials ?? {})).toEqual(["telegramApi"]);
      expect(String(telegram[0].parameters?.chatId)).toMatch(/^=\{\{ \$json\.(chatId|telegramChatId) \}\}$/);
      // Only Telegram nodes reference credentials, and only by placeholder id.
      expect(wf.nodes.filter((n) => n.credentials).map((n) => n.type)).toEqual(["n8n-nodes-base.telegram"]);
      // A Telegram bot token looks like `123456789:AA…`; none may be committed.
      expect(JSON.stringify(wf)).not.toMatch(/\d{6,}:[\w-]{30,}|CRON_SECRET|Bearer |eyJ[\w-]+\./);
    }
  });
});
