#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$PROJECT_ROOT"

set -a
. ./.env.prod
set +a
DATABASE_URL_PSQL="${DATABASE_URL%%\?*}"

psql_file() {
  docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T \
    -e DATABASE_URL_PSQL="$DATABASE_URL_PSQL" \
    postgres \
    sh -lc 'psql "$DATABASE_URL_PSQL" -v ON_ERROR_STOP=1' < "$1"
}

psql_copy() {
  local csv_file="$1"
  local copy_sql="$2"

  docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T \
    -e DATABASE_URL_PSQL="$DATABASE_URL_PSQL" \
    postgres \
    sh -lc 'psql "$DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -c "$0"' "$copy_sql" < "$csv_file"
}

psql_file "$PACKAGE_DIR/sql/01_create_staging.sql"
psql_copy "$PACKAGE_DIR/data/clientes.csv" 'COPY staging_lopest_sheets.clientes FROM STDIN WITH (FORMAT csv, HEADER true)'
psql_copy "$PACKAGE_DIR/data/creditos.csv" 'COPY staging_lopest_sheets.creditos FROM STDIN WITH (FORMAT csv, HEADER true)'
psql_copy "$PACKAGE_DIR/data/cuotas.csv" 'COPY staging_lopest_sheets.cuotas FROM STDIN WITH (FORMAT csv, HEADER true)'
psql_file "$PACKAGE_DIR/sql/02_dry_run.sql"
psql_file "$PACKAGE_DIR/sql/03_apply.sql"
