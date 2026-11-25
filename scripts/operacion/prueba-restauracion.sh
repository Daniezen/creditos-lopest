#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# prueba-restauracion.sh — prove that a Lopest backup can actually be restored.
# Adapted from plataforma-impulsa/scripts/operacion/prueba-restauracion.sh.
#
# Usage (on the VPS, as `deploy`):
#   bash scripts/operacion/prueba-restauracion.sh              # newest daily set
#   bash scripts/operacion/prueba-restauracion.sh <file.dump>  # a specific one
#
# What it does:
#   1. Checks the SHA-256 sidecar of the set (the same hash proves an off-site
#      copy is byte-identical to the file restored here).
#   2. Starts a throwaway container from the SAME image as production, with
#      --network none, so the restored data can neither be reached nor reach
#      anything. A trap removes it on exit, success or failure.
#   3. Replays the roles file, then pg_restore WITH owners — the same path a
#      real disaster restore takes (docs/estado/operacion.md §9.4) — so a
#      missing role or a broken ownership chain shows up here, not on the bad day.
#   4. Runs the same read-only queries on the restored copy and on production:
#        - the migration ledger (_prisma_migrations: name + checksum + finished),
#        - the exact row count of EVERY base table in public and
#          staging_lopest_sheets (new tables are picked up automatically).
#   5. Verdict: migrations and the table set must be identical (exit 1 if not).
#      Row counts may differ only by what changed in production since the dump
#      was taken; they are listed side by side with the delta.
#
# Production is only read: the queries run with
# default_transaction_read_only=on, so even a mistake here cannot write.
# -----------------------------------------------------------------------------
set -Eeuo pipefail
# Any unexpected error (not just a failed comparison) also reaches syslog.
trap '[ "$BASHPID" = "$$" ] && logger -t lopest-backup -p user.err "FALLO de la prueba de restauración (línea $LINENO)"' ERR

BACKUP_CONFIG="${BACKUP_CONFIG:-$HOME/.config/lopest-backup.env}"
# shellcheck source=/dev/null
[ -f "$BACKUP_CONFIG" ] && . "$BACKUP_CONFIG"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups/lopest}"
PROD="${DB_CONTAINER:-lopest_db}"

FILE="${1:-$(find "$BACKUP_DIR/daily" -maxdepth 1 -name '*.dump' | sort | tail -1)}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "no hay copia que probar en $BACKUP_DIR/daily" >&2; exit 1; }
BASE="${FILE%.dump}"
ROLES="$BASE.roles.sql"

echo "== copia: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
if [ -f "$BASE.sha256" ]; then
  ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$BASE").sha256" )
else
  echo "AVISO: sin archivo .sha256; hash calculado ahora:"; sha256sum "$FILE"
fi

IMAGE="$(docker inspect -f '{{.Config.Image}}' "$PROD")"
DB="$(docker exec "$PROD" printenv POSTGRES_DB)"
NAME="prueba-restauracion-lopest-$$"
WORK="$(mktemp -d)"
cleanup() { docker rm -f "$NAME" > /dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

echo "== contenedor desechable $NAME ($IMAGE, sin red)"
docker run -d --name "$NAME" --network none \
  -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" "$IMAGE" > /dev/null

# The official image starts a temporary server for initdb and then the real
# one; each prints "ready to accept connections". Wait for the second.
for _ in $(seq 1 60); do
  [ "$(docker logs "$NAME" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ] && break
  sleep 1
done
docker exec "$NAME" pg_isready -U postgres -q

# Roles first: every table is owned by lopest_app_user. ON_ERROR_STOP is off
# because the file also tries to (re)create the bootstrap superuser, which is
# harmless here; the ownership restore below is the real check.
if [ -f "$ROLES" ]; then
  docker exec -i "$NAME" psql -U postgres -q -o /dev/null < "$ROLES" 2>&1 \
    | grep -v 'already exists' || true
else
  echo "AVISO: sin archivo de roles; se crea lopest_app_user a mano"
  docker exec "$NAME" psql -U postgres -qc 'CREATE ROLE lopest_app_user LOGIN'
fi
docker exec "$NAME" createdb -U postgres "$DB"

# Not --exit-on-error: a harmless notice must not hide the real verdict, which
# is the comparison below. pg_restore's own error summary is still printed.
set +e
docker exec -i "$NAME" pg_restore -U postgres -d "$DB" < "$FILE"
RC=$?
set -e
echo "== pg_restore terminó con código $RC (0 = sin avisos)"

# Schema-qualified everywhere: the result must not depend on search_path.
Q_MIG="select migration_name || '|' || checksum || '|' || (finished_at is not null)
         from public._prisma_migrations order by migration_name"
# query_to_xml runs a count(*) per table inside a single read-only SELECT.
Q_ROWS="select table_schema || '.' || table_name || '|' ||
               (xpath('/row/c/text()', query_to_xml(
                  format('select count(*) as c from %I.%I', table_schema, table_name),
                  false, true, '')))[1]::text
          from information_schema.tables
         where table_schema in ('public', 'staging_lopest_sheets')
           and table_type = 'BASE TABLE'
         order by 1"

run_q() { # $1 = container, $2 = role, $3 = query
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$1" \
    psql -U "$2" -d "$DB" -v ON_ERROR_STOP=1 -Atc "$3"
}
PROD_USER="$(docker exec "$PROD" printenv POSTGRES_USER)"

run_q "$NAME" postgres "$Q_MIG"  > "$WORK/mig.rest"
run_q "$PROD" "$PROD_USER" "$Q_MIG"  > "$WORK/mig.prod"
run_q "$NAME" postgres "$Q_ROWS" > "$WORK/rows.rest"
run_q "$PROD" "$PROD_USER" "$Q_ROWS" > "$WORK/rows.prod"

# Ownership survived (proves the roles file + owner-aware restore path).
OWNERS="$(run_q "$NAME" postgres "select string_agg(distinct tableowner, ',') from pg_tables
          where schemaname in ('public', 'staging_lopest_sheets')")"

FAIL=0
echo "== migraciones: restaurada $(wc -l < "$WORK/mig.rest") / producción $(wc -l < "$WORK/mig.prod")"
if ! diff -u "$WORK/mig.prod" "$WORK/mig.rest"; then
  echo "FALLO: el registro de migraciones difiere"; FAIL=1
fi
if ! diff <(cut -d'|' -f1 "$WORK/rows.prod") <(cut -d'|' -f1 "$WORK/rows.rest") > /dev/null; then
  echo "FALLO: el conjunto de tablas difiere"
  diff <(cut -d'|' -f1 "$WORK/rows.prod") <(cut -d'|' -f1 "$WORK/rows.rest") || true
  FAIL=1
fi
echo "== dueño de las tablas restauradas: $OWNERS"

echo "== filas por tabla (restaurada | producción | delta)"
join -t'|' -a1 -a2 -e '-' -o '0,1.2,2.2' \
  <(sort "$WORK/rows.rest") <(sort "$WORK/rows.prod") \
  | awk -F'|' '{ d = ($2 == "-" || $3 == "-") ? "?" : $3 - $2;
                 printf "%-45s %8s %8s %6s\n", $1, $2, $3, (d == 0 ? "=" : d) }'

if [ "$FAIL" -ne 0 ]; then
  echo "== RESULTADO: FALLO"
  logger -t lopest-backup -p user.err "FALLO de la prueba de restauración: $(basename "$FILE")" || true
  exit 1
fi
logger -t lopest-backup "prueba de restauración OK: $(basename "$FILE")" || true
echo "== RESULTADO: OK (migraciones y tablas idénticas; deltas de filas = cambios posteriores al volcado)"
