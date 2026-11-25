-- The audit log and the reversal snapshots become append-only, enforced by
-- PostgreSQL instead of trusted to every code path.
--
-- Scope (inventory of 25-nov-2026, see docs/estado/auditoria-append-only.md):
--   * "audit_logs": the record of who did what. Never rewritten, never erased.
--   * "abono_snapshots": before/after image of a capital payment, written once
--     and only read afterwards. The abono reversal
--     (src/features/creditos/abonos/reversal-actions.ts) deletes the abono
--     event and the snapshot goes with it through the ON DELETE CASCADE of
--     "abono_snapshots_abonoEventoId_fkey". That cascade is the ONLY delete
--     this table accepts: the trigger refuses a DELETE while the abono event
--     still exists (a direct delete) or once the credit is gone (a physical
--     credit delete, which the app never does: credits are soft-deleted).
--   * "extension_plazo_snapshots": image of a term extension. The reversal
--     (src/features/creditos/plazos/actions.ts) marks it reverted by setting
--     "revertidoEn", "revertidoPor" and "motivoReversion". That single
--     transition, NULL -> set, once, touching nothing else, is the ONLY update
--     it accepts. It is never deleted.
--   Left out on purpose: "eventos_financieros" (the live payment schedule,
--   updated by every payment), "secuencias_credito", "documentos_cliente" and
--   the auth tables: mutable state, not records.
--
-- Two layers, because of how production is set up (read on 25-nov-2026):
--   1. Triggers. "lopest_app_user" is at once the role the app connects with,
--      the role "prisma migrate deploy" connects with (same DATABASE_URL in
--      docker-compose.prod.yml) and the OWNER of every table. An owner can
--      always GRANT itself back any privilege, so privileges alone guarantee
--      nothing here. Triggers fire for every role and also for referential
--      actions (ON DELETE CASCADE / SET NULL run ordinary row deletes and
--      updates as the table owner, and row triggers see them). Getting past
--      them takes DDL (ALTER TABLE ... DISABLE TRIGGER, DROP TRIGGER) or
--      session_replication_role = replica (superuser only): deliberate acts
--      that Prisma Client never issues.
--   2. REVOKE from "lopest_app_user". Today it only stops plain DML from the
--      owner itself (an app bug gets `permission denied` before reaching the
--      trigger); it becomes a real guarantee once ownership moves to a
--      separate role (phase 2 in the doc above, needs the superuser). The
--      role is named literally, like everywhere else in this repo. Where it
--      does not exist (local dev connects as the superuser "lopest_admin")
--      the REVOKE is skipped with a NOTICE and the triggers still apply.
--
-- Referential actions that touch these tables, and what happens now:
--   * audit_logs.actorId -> users ON DELETE SET NULL: that SET NULL is an
--     UPDATE of the audit row, so deleting a user who has audit now FAILS.
--     Intended: users are deactivated ("activo"), no code deletes them.
--   * abono_snapshots -> eventos_financieros CASCADE: allowed (abono reversal).
--   * abono_snapshots / extension_plazo_snapshots -> creditos CASCADE: a
--     physical credit delete with snapshots now FAILS. Intended: credits are
--     soft-deleted ("eliminadoEn"), no code deletes them.
--   * ON UPDATE CASCADE of the parents' ids would rewrite these rows and is
--     refused too; cuid ids are never updated.
--   The foreign keys themselves are left as they are: no schema drift, and the
--   triggers already decide.
--
-- Idempotent: CREATE OR REPLACE for functions and triggers, REVOKE/GRANT of a
-- privilege already absent/present is a no-op, and the closing block only
-- reads. A REVOKE that removes nothing is only a WARNING in PostgreSQL, so the
-- closing block re-reads the effective state and aborts the migration if a
-- trigger is missing or disabled or a privilege survived: a silent no-op can
-- never pass as success.
--
-- No data changes, no table rewrite. CREATE TRIGGER takes a SHARE ROW
-- EXCLUSIVE lock on each table for an instant.
--
-- Manual rollback (as the table owner; full procedure in the doc above):
--   DROP TRIGGER IF EXISTS audit_logs_append_only ON "audit_logs";
--   DROP TRIGGER IF EXISTS audit_logs_no_truncate ON "audit_logs";
--   DROP TRIGGER IF EXISTS abono_snapshots_append_only ON "abono_snapshots";
--   DROP TRIGGER IF EXISTS abono_snapshots_no_truncate ON "abono_snapshots";
--   DROP TRIGGER IF EXISTS extension_plazo_snapshots_append_only ON "extension_plazo_snapshots";
--   DROP TRIGGER IF EXISTS extension_plazo_snapshots_no_truncate ON "extension_plazo_snapshots";
--   DROP FUNCTION IF EXISTS lopest_reject_rewrite(), lopest_abono_snapshot_guard(), lopest_extension_snapshot_guard();
--   GRANT UPDATE, DELETE, TRUNCATE ON "audit_logs", "abono_snapshots", "extension_plazo_snapshots" TO "lopest_app_user";

-- ---------------------------------------------------------------------------
-- 1. Guard functions
-- ---------------------------------------------------------------------------

-- Refuses any rewrite. Used for every row operation on audit_logs and for
-- TRUNCATE on the three tables (statement-level: TRUNCATE fires no row
-- triggers and skips ON DELETE actions, so it needs its own guard).
CREATE OR REPLACE FUNCTION lopest_reject_rewrite() RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % on "%" is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege',
          HINT = 'Audit and snapshot rows are immutable; see docs/estado/auditoria-append-only.md.';
END
$$;

-- abono_snapshots: no UPDATE; DELETE only as the cascade of an abono reversal.
-- When the cascade runs, the abono event row is already deleted in this
-- transaction (the referential action fires AFTER the parent delete), while
-- the credit still exists. A direct DELETE finds the event; a physical credit
-- delete finds no credit. Both are refused.
CREATE OR REPLACE FUNCTION lopest_abono_snapshot_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM "eventos_financieros" e WHERE e."id" = OLD."abonoEventoId")
     AND EXISTS (SELECT 1 FROM "creditos" c WHERE c."id" = OLD."creditoId") THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'append-only: % on "abono_snapshots" is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          DETAIL = 'A snapshot is removed only together with its abono event, by the abono reversal.',
          HINT = 'See docs/estado/auditoria-append-only.md.';
END
$$;

-- extension_plazo_snapshots: no DELETE; UPDATE only to mark it reverted, once.
-- Comparing the rows as jsonb minus the three reversal columns proves nothing
-- else changed, whatever columns a future migration adds.
CREATE OR REPLACE FUNCTION lopest_extension_snapshot_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."revertidoEn" IS NULL
     AND NEW."revertidoEn" IS NOT NULL
     AND NEW."revertidoPor" IS NOT NULL
     AND OLD."revertidoPor" IS NULL
     AND OLD."motivoReversion" IS NULL
     AND (to_jsonb(NEW) - 'revertidoEn' - 'revertidoPor' - 'motivoReversion')
       = (to_jsonb(OLD) - 'revertidoEn' - 'revertidoPor' - 'motivoReversion') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'append-only: % on "extension_plazo_snapshots" is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          DETAIL = 'The only change allowed is marking a snapshot reverted once (revertidoEn, revertidoPor, motivoReversion).',
          HINT = 'See docs/estado/auditoria-append-only.md.';
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Triggers (BEFORE, so the row is never touched)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION lopest_reject_rewrite();
CREATE OR REPLACE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION lopest_reject_rewrite();

CREATE OR REPLACE TRIGGER abono_snapshots_append_only
  BEFORE UPDATE OR DELETE ON "abono_snapshots"
  FOR EACH ROW EXECUTE FUNCTION lopest_abono_snapshot_guard();
CREATE OR REPLACE TRIGGER abono_snapshots_no_truncate
  BEFORE TRUNCATE ON "abono_snapshots"
  FOR EACH STATEMENT EXECUTE FUNCTION lopest_reject_rewrite();

CREATE OR REPLACE TRIGGER extension_plazo_snapshots_append_only
  BEFORE UPDATE OR DELETE ON "extension_plazo_snapshots"
  FOR EACH ROW EXECUTE FUNCTION lopest_extension_snapshot_guard();
CREATE OR REPLACE TRIGGER extension_plazo_snapshots_no_truncate
  BEFORE TRUNCATE ON "extension_plazo_snapshots"
  FOR EACH STATEMENT EXECUTE FUNCTION lopest_reject_rewrite();

-- ---------------------------------------------------------------------------
-- 3. Privileges of the runtime role
-- ---------------------------------------------------------------------------
-- abono_snapshots keeps DELETE: the reversal cascade runs as the table owner,
-- and today the owner IS lopest_app_user; without DELETE the reversal fails.
-- extension_plazo_snapshots keeps UPDATE only on the three reversal columns.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lopest_app_user') THEN
    RAISE NOTICE 'role lopest_app_user does not exist here; privileges untouched, triggers still apply';
    RETURN;
  END IF;

  REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_logs" FROM "lopest_app_user";
  REVOKE UPDATE, TRUNCATE ON TABLE "abono_snapshots" FROM "lopest_app_user";
  REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "extension_plazo_snapshots" FROM "lopest_app_user";
  GRANT UPDATE ("revertidoEn", "revertidoPor", "motivoReversion")
    ON TABLE "extension_plazo_snapshots" TO "lopest_app_user";
END
$$;

-- ---------------------------------------------------------------------------
-- 4. Verification: abort if anything above did not take effect
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  missing text;
  survivors text;
BEGIN
  -- Every guard trigger must exist on its table and be enabled ('O' = origin,
  -- 'A' = always). 'D' (disabled) or 'R' (replica only) would be a hole.
  SELECT string_agg(format('%s.%s', t.table_name, t.trigger_name), ', ' ORDER BY t.table_name, t.trigger_name)
    INTO missing
    FROM (VALUES
      ('audit_logs', 'audit_logs_append_only'),
      ('audit_logs', 'audit_logs_no_truncate'),
      ('abono_snapshots', 'abono_snapshots_append_only'),
      ('abono_snapshots', 'abono_snapshots_no_truncate'),
      ('extension_plazo_snapshots', 'extension_plazo_snapshots_append_only'),
      ('extension_plazo_snapshots', 'extension_plazo_snapshots_no_truncate')
    ) AS t(table_name, trigger_name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_trigger g
      WHERE g.tgrelid = to_regclass(format('%I', t.table_name))
        AND g.tgname = t.trigger_name
        AND g.tgenabled IN ('O', 'A'));

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'append-only guard triggers missing or disabled: %', missing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lopest_app_user') THEN
    RETURN;
  END IF;

  -- `keeps` lists the one table-level privilege that is intentional.
  SELECT string_agg(format('%s %s', t.table_name, p.priv), ', ' ORDER BY t.table_name, p.priv)
    INTO survivors
    FROM (VALUES
      ('audit_logs', NULL),
      ('abono_snapshots', 'DELETE'),
      ('extension_plazo_snapshots', NULL)
    ) AS t(table_name, keeps)
    CROSS JOIN (VALUES ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(priv)
   WHERE p.priv IS DISTINCT FROM t.keeps
     AND has_table_privilege('lopest_app_user', format('%I', t.table_name), p.priv);

  -- Column-level UPDATE on extension_plazo_snapshots: exactly the three
  -- reversal columns, nothing else.
  SELECT concat_ws(', ', survivors, string_agg(format('extension_plazo_snapshots.%s UPDATE', a.attname), ', ' ORDER BY a.attname))
    INTO survivors
    FROM pg_attribute a
   WHERE a.attrelid = '"extension_plazo_snapshots"'::regclass
     AND a.attnum > 0 AND NOT a.attisdropped
     AND a.attname NOT IN ('revertidoEn', 'revertidoPor', 'motivoReversion')
     AND has_column_privilege('lopest_app_user', a.attrelid, a.attnum, 'UPDATE');

  IF survivors IS NOT NULL AND survivors <> '' THEN
    RAISE EXCEPTION 'lopest_app_user can still rewrite append-only tables: %', survivors
      USING HINT = 'The privilege was granted by a role other than the table owner; revoke it as that grantor and retry.';
  END IF;

  IF NOT (has_column_privilege('lopest_app_user', '"extension_plazo_snapshots"', 'revertidoEn', 'UPDATE')
      AND has_column_privilege('lopest_app_user', '"extension_plazo_snapshots"', 'revertidoPor', 'UPDATE')
      AND has_column_privilege('lopest_app_user', '"extension_plazo_snapshots"', 'motivoReversion', 'UPDATE')
      AND has_table_privilege('lopest_app_user', '"abono_snapshots"', 'DELETE')
      AND has_table_privilege('lopest_app_user', '"audit_logs"', 'INSERT')
      AND has_table_privilege('lopest_app_user', '"audit_logs"', 'SELECT')) THEN
    RAISE EXCEPTION 'lopest_app_user lost a privilege the reversals or the audit writer need';
  END IF;
END
$$;
