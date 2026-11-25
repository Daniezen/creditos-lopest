#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# backup-db.sh — nightly logical backup of the Lopest production database.
#
# Usage (on the VPS, as `deploy`, which is in the `docker` group):
#   bash scripts/operacion/backup-db.sh
# Meant to run from the host crontab (see docs/estado/operacion.md §8).
#
# What it does, in order. Any failure aborts the run with exit code != 0, a
# line in syslog (`journalctl -t lopest-backup`) and an ESTADO file that says
# FALLO, so a broken backup is never silent:
#   1. Takes a lock so two runs can never overlap.
#   2. Runs `pg_dump -Fc` INSIDE `lopest_db` (same 18.4 binaries as the server)
#      and streams it to `<BACKUP_DIR>/daily/<db>_<stamp>.dump.partial`.
#      pg_dump is read-only: it takes a consistent snapshot and never writes.
#   3. Dumps the cluster roles (`pg_dumpall --roles-only --no-role-passwords`).
#      Roles are global objects that a single-database dump does NOT carry, and
#      every Lopest table is owned by `lopest_app_user`: without this file a
#      restore on a new server fails on ownership. Passwords are left out on
#      purpose; they live in `.env.prod`.
#   4. Validates the dump (non-trivial size, readable TOC, data of the key
#      tables present) BEFORE publishing it, then writes a SHA-256 sidecar and
#      renames `.partial` away atomically.
#   5. On WEEKLY_DAY, hard-links the set into `weekly/` (no extra disk).
#   6. Prunes: keeps the newest KEEP_DAILY sets in daily/ and KEEP_WEEKLY in
#      weekly/. Pruning only runs after a successful dump, so a failing backup
#      can never eat the good copies.
#   7. Optional off-site copy with rclone (disabled unless OFFSITE_REMOTE set).
#   8. Optional heartbeat ping (disabled unless HEALTHCHECK_URL set).
#
# Configuration: environment variables, or the file in BACKUP_CONFIG
# (default ~/.config/lopest-backup.env). See backup.env.example next to this
# script. Nothing here needs `.env.prod`: credentials are taken from the
# container's own environment (POSTGRES_USER / POSTGRES_DB).
# -----------------------------------------------------------------------------
set -Eeuo pipefail
umask 077 # dumps contain personal and financial data: owner-only files.

BACKUP_CONFIG="${BACKUP_CONFIG:-$HOME/.config/lopest-backup.env}"
# shellcheck source=/dev/null
[ -f "$BACKUP_CONFIG" ] && . "$BACKUP_CONFIG"

BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups/lopest}"
DB_CONTAINER="${DB_CONTAINER:-lopest_db}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_WEEKLY="${KEEP_WEEKLY:-8}"
WEEKLY_DAY="${WEEKLY_DAY:-7}"           # ISO weekday: 1 = Monday ... 7 = Sunday
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-50000}" # dump was ~530 KB on 25-nov-2026; <50 KB = empty/broken
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"     # e.g. "gdrive:Backups/lopest" — empty = off
RCLONE_IMAGE="${RCLONE_IMAGE:-rclone/rclone:1.68.2}"
RCLONE_CONFIG_DIR="${RCLONE_CONFIG_DIR:-$HOME/.config/rclone}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"   # healthchecks.io-style URL — empty = off

# Tables whose data MUST be in every dump. If one is missing from the TOC the
# dump is rejected: it means the schema changed or pg_dump saw the wrong DB.
KEY_TABLES=(clientes creditos eventos_financieros users _prisma_migrations)

STAMP="$(date +%Y%m%dT%H%M%S)"
LOG_TAG="lopest-backup"
STATUS_FILE="$BACKUP_DIR/ESTADO"

log() { echo "[$(date '+%F %T')] $*"; }

ping_hc() { # $1 = "" on success, "/fail" on failure. Never fails the script.
  [ -n "$HEALTHCHECK_URL" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_URL}$1" || true
}

on_error() {
  local rc=$? line=$1
  # set -E makes $(...) subshells inherit this trap: let only the main shell
  # report, or a single failure would be logged twice.
  [ "$BASHPID" = "$$" ] || exit "$rc"
  log "FALLO: backup abortado en la línea $line (código $rc)" >&2
  logger -t "$LOG_TAG" -p user.err "FALLO del backup de Lopest (línea $line, código $rc)" || true
  mkdir -p "$BACKUP_DIR" && echo "FALLO $(date -Is) linea=$line codigo=$rc" > "$STATUS_FILE" || true
  rm -f "${PARTIAL:-}" "${ROLES_PARTIAL:-}"
  ping_hc /fail
  exit "$rc"
}
trap 'on_error $LINENO' ERR

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

# 1. Lock: a second run (manual + cron) waits up to 10 min, then fails loudly.
exec 9> "$BACKUP_DIR/.lock"
flock -w 600 9

# The container must be running; `docker exec` on a stopped one would fail
# anyway, but this message says why.
[ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER")" = "true" ]

DB_NAME="$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB)"
BASE="$BACKUP_DIR/daily/${DB_NAME}_${STAMP}"
PARTIAL="$BASE.dump.partial"
ROLES_PARTIAL="$BASE.roles.sql.partial"

# 2. Database dump. `sh -c` so $POSTGRES_USER/$POSTGRES_DB expand inside the
# container. Local socket auth: no password crosses the command line.
log "pg_dump de $DB_NAME en $DB_CONTAINER"
docker exec "$DB_CONTAINER" sh -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6' \
  > "$PARTIAL"

# 3. Roles (global objects), without password hashes.
docker exec "$DB_CONTAINER" sh -c \
  'exec pg_dumpall -U "$POSTGRES_USER" --roles-only --no-role-passwords' \
  > "$ROLES_PARTIAL"

# 4. Validation before publishing.
SIZE="$(stat -c %s "$PARTIAL")"
if [ "$SIZE" -lt "$MIN_DUMP_BYTES" ]; then
  log "dump de $SIZE bytes, menor que el mínimo $MIN_DUMP_BYTES" >&2
  false
fi
# pg_restore --list reads only the TOC; any corruption in the header fails it.
TOC="$(docker exec -i "$DB_CONTAINER" pg_restore --list < "$PARTIAL")"
for t in "${KEY_TABLES[@]}"; do
  if ! grep -Eq "TABLE DATA public ${t} " <<< "$TOC"; then
    log "el dump no contiene datos de la tabla public.$t" >&2
    false
  fi
done
grep -q 'CREATE ROLE lopest_app_user' "$ROLES_PARTIAL"

mv "$PARTIAL" "$BASE.dump"
mv "$ROLES_PARTIAL" "$BASE.roles.sql"
# Relative names inside the sidecar so `sha256sum -c` works from any copy dir.
( cd "$BACKUP_DIR/daily" && sha256sum "$(basename "$BASE").dump" "$(basename "$BASE").roles.sql" \
    > "$(basename "$BASE").sha256" )
log "copia lista: $BASE.dump ($(du -h "$BASE.dump" | cut -f1))"
cut -d' ' -f1 < "$BASE.sha256" | head -1 | sed 's/^/sha256 /'

# 5. Weekly copy as hard links (same filesystem, zero extra bytes).
if [ "$(date +%u)" = "$WEEKLY_DAY" ]; then
  for f in "$BASE".dump "$BASE".roles.sql "$BASE".sha256; do
    ln -f "$f" "$BACKUP_DIR/weekly/"
  done
  log "copia semanal enlazada"
fi

# 6. Retention by count of sets (a set = .dump + .roles.sql + .sha256).
prune() { # $1 = dir, $2 = sets to keep
  local dir=$1 keep=$2 old
  # Names embed a sortable timestamp, so lexical order == chronological order.
  # find, not ls: an empty dir must not make the pipeline fail under pipefail.
  find "$dir" -maxdepth 1 -name '*.dump' | sort -r | tail -n +"$((keep + 1))" | while read -r old; do
    rm -f "$old" "${old%.dump}.roles.sql" "${old%.dump}.sha256"
    log "retención: borrado $(basename "$old")"
  done
}
prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"

# 7. Off-site copy. `copy` (never `sync`): deleting or encrypting the local
# directory can never propagate deletions to the remote. The remote grows by
# ~0.5 MB per day; prune it by hand or with the remote's own retention.
if [ -n "$OFFSITE_REMOTE" ]; then
  log "copia off-site a $OFFSITE_REMOTE"
  docker run --rm --user "$(id -u):$(id -g)" \
    -v "$RCLONE_CONFIG_DIR:/config/rclone" \
    -v "$BACKUP_DIR:/data:ro" \
    "$RCLONE_IMAGE" copy /data "$OFFSITE_REMOTE" \
      --include '/daily/**' --include '/weekly/**' --exclude '*.partial' \
      --checksum --retries 3 --low-level-retries 10 --stats-one-line -v
fi

echo "OK $(date -Is) $(basename "$BASE").dump" > "$STATUS_FILE"
logger -t "$LOG_TAG" "backup OK: $(basename "$BASE").dump ($SIZE bytes)" || true
ping_hc ""
log "fin OK"
