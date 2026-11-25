import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The audit log and the reversal snapshots are append-only, and PostgreSQL
 * enforces it (migration `20261125120000_audit_append_only_v1`, procedure in
 * `docs/estado/auditoria-append-only.md`).
 *
 * The database is the guarantee; these assertions are the early warning. A
 * code path that rewrites one of these rows would compile and pass every
 * other test, then fail in production with `permission denied` or
 * `append-only: ...`. Here it fails first, at review time.
 *
 * They read files only. Whether the triggers and privileges really are in
 * place in a database is checked by the migration's closing block, which
 * aborts otherwise.
 */

// Vitest runs from `web/`, where package.json lives.
const WEB_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(WEB_ROOT, "prisma/migrations");
const UNIT_NAME = "20261125120000_audit_append_only_v1";
const UNIT_MIGRATION = path.join(MIGRATIONS_DIR, UNIT_NAME, "migration.sql");

const read = (file: string) => fs.readFileSync(file, "utf8");

/** SQL without comments and quotes, whitespace collapsed: easy to match. */
const flat = (sql: string) => sql.replace(/--.*$/gm, "").replaceAll('"', "").replace(/\s+/g, " ");

/** Every application source file that can reach the database. */
function sourceFiles(): string[] {
  const files: string[] = [];
  for (const root of ["src", "scripts"]) {
    const dir = path.join(WEB_ROOT, root);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { recursive: true })) {
      const rel = path.join(root, String(entry)).replaceAll(path.sep, "/");
      if (!/\.(ts|tsx|js|mjs|sql)$/.test(rel)) continue;
      if (/\.test\.(ts|tsx|mjs)$/.test(rel) || rel.includes("/generated/")) continue;
      files.push(rel);
    }
  }
  return files;
}

/** Guard triggers the migration creates, per table. */
const TRIGGERS: Record<string, string[]> = {
  audit_logs: ["audit_logs_append_only", "audit_logs_no_truncate"],
  abono_snapshots: ["abono_snapshots_append_only", "abono_snapshots_no_truncate"],
  extension_plazo_snapshots: ["extension_plazo_snapshots_append_only", "extension_plazo_snapshots_no_truncate"],
};

/** The only columns the extension reversal may write. */
const EXTENSION_REVERSAL_COLUMNS = ["revertidoEn", "revertidoPor", "motivoReversion"];

/** The single caller allowed to update an extension snapshot. */
const EXTENSION_REVERSAL_FILE = "src/features/creditos/plazos/actions.ts";

describe("audit append-only migration", () => {
  const sql = flat(read(UNIT_MIGRATION));

  it("creates every guard trigger BEFORE the operation", () => {
    for (const [table, names] of Object.entries(TRIGGERS)) {
      const [rowTrigger, truncateTrigger] = names;
      expect(sql).toContain(`CREATE OR REPLACE TRIGGER ${rowTrigger} BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW`);
      expect(sql).toContain(`CREATE OR REPLACE TRIGGER ${truncateTrigger} BEFORE TRUNCATE ON ${table} FOR EACH STATEMENT`);
    }
  });

  it("revokes rewrite privileges from the runtime role, keeping only what reversals need", () => {
    /**
     * abono_snapshots keeps DELETE: the abono reversal deletes the event and
     * the snapshot follows by ON DELETE CASCADE, run as the table owner.
     * extension_plazo_snapshots keeps UPDATE on the reversal columns only.
     */
    expect(sql).toContain("REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM lopest_app_user;");
    expect(sql).toContain("REVOKE UPDATE, TRUNCATE ON TABLE abono_snapshots FROM lopest_app_user;");
    expect(sql).toContain("REVOKE UPDATE, DELETE, TRUNCATE ON TABLE extension_plazo_snapshots FROM lopest_app_user;");
    expect(sql).toContain(
      `GRANT UPDATE (${EXTENSION_REVERSAL_COLUMNS.join(", ")}) ON TABLE extension_plazo_snapshots TO lopest_app_user;`,
    );
    expect(sql).not.toMatch(/GRANT [^;]*\bON TABLE audit_logs\b/);
  });

  it("aborts when a trigger is missing or a privilege survived instead of trusting the REVOKE", () => {
    /** A REVOKE that removes nothing is only a WARNING in PostgreSQL. */
    expect(sql).toContain("RAISE EXCEPTION 'append-only guard triggers missing or disabled: %'");
    expect(sql).toContain("RAISE EXCEPTION 'lopest_app_user can still rewrite append-only tables: %'");
    expect(sql).toContain("tgenabled IN ('O', 'A')");
    for (const names of Object.values(TRIGGERS)) {
      for (const name of names) expect(sql).toContain(`'${name}'`);
    }
  });

  it("no later migration drops a guard or gives the rewrite privileges back", () => {
    const later = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name > UNIT_NAME)
      .map((entry) => ({ name: entry.name, sql: flat(read(path.join(MIGRATIONS_DIR, entry.name, "migration.sql"))) }));

    const tables = Object.keys(TRIGGERS).join("|");
    const guards = Object.values(TRIGGERS).flat().join("|");
    for (const { name, sql: laterSql } of later) {
      expect(laterSql, `${name} drops or disables a guard`).not.toMatch(
        new RegExp(`(DROP TRIGGER [^;]*\\b(${guards})\\b|DISABLE TRIGGER|DROP FUNCTION [^;]*lopest_(reject_rewrite|abono_snapshot_guard|extension_snapshot_guard))`),
      );
      expect(laterSql, `${name} grants rewrite privileges back`).not.toMatch(
        new RegExp(`GRANT [^;]*\\b(UPDATE|DELETE|TRUNCATE|ALL)\\b[^;]*\\bON (TABLE )?[^;]*\\b(${tables})\\b`),
      );
    }
  });
});

describe("application code respects the append-only tables", () => {
  const files = sourceFiles().map((file) => ({ file, code: read(path.join(WEB_ROOT, file)) }));

  it("never rewrites or deletes an audit row", () => {
    const offenders = files.flatMap(({ file, code }) =>
      [...code.matchAll(/\.auditLog\.(update|updateMany|upsert|delete|deleteMany)\(/g)].map((m) => `${file}: auditLog.${m[1]}`),
    );
    expect(offenders).toEqual([]);
  });

  it("never updates an abono snapshot nor deletes it directly", () => {
    /** The only removal is the cascade of the abono event in the reversal. */
    const offenders = files.flatMap(({ file, code }) =>
      [...code.matchAll(/\.abonoSnapshot\.(update|updateMany|upsert|delete|deleteMany)\(/g)].map(
        (m) => `${file}: abonoSnapshot.${m[1]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("only the extension reversal updates an extension snapshot, and only its reversal columns", () => {
    const offenders: string[] = [];
    for (const { file, code } of files) {
      for (const m of code.matchAll(/\.extensionPlazoSnapshot\.(update|updateMany|upsert|delete|deleteMany)\(/g)) {
        if (m[1] !== "update" || file !== EXTENSION_REVERSAL_FILE) {
          offenders.push(`${file}: extensionPlazoSnapshot.${m[1]}`);
          continue;
        }
        // The `data` object of this call, on one line in the reversal.
        const call = code.slice(m.index, code.indexOf(");", m.index));
        const data = call.match(/data:\s*\{([^}]*)\}/)?.[1] ?? "";
        const keys = [...data.matchAll(/(\w+)\s*:/g)].map((k) => k[1]);
        const extra = keys.filter((key) => !EXTENSION_REVERSAL_COLUMNS.includes(key));
        if (keys.length === 0 || extra.length > 0) offenders.push(`${file}: extensionPlazoSnapshot.update writes ${keys.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("issues no raw SQL that rewrites these tables", () => {
    const raw = /\b(?:UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?"?(?:public"?\."?)?(audit_logs|abono_snapshots|extension_plazo_snapshots)\b/gi;
    const offenders = files.flatMap(({ file, code }) => [...code.matchAll(raw)].map((m) => `${file}: raw SQL on ${m[1]}`));
    expect(offenders).toEqual([]);
  });
});
