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
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$PACKAGE_DIR/salidas"
OUT_FILE="$OUT_DIR/compare_db_vs_sheets_$TIMESTAMP.txt"
mkdir -p "$OUT_DIR"

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

{
  echo "[INFO] Comparacion DB vs export Sheets"
  echo "[INFO] Fecha: $TIMESTAMP"
  echo "[INFO] Proyecto: $PROJECT_ROOT"
  echo

  psql_file "$PACKAGE_DIR/sql/01_create_staging.sql"
  psql_copy "$PACKAGE_DIR/data/clientes.csv" 'COPY staging_lopest_sheets.clientes FROM STDIN WITH (FORMAT csv, HEADER true)'
  psql_copy "$PACKAGE_DIR/data/creditos.csv" 'COPY staging_lopest_sheets.creditos FROM STDIN WITH (FORMAT csv, HEADER true)'
  psql_copy "$PACKAGE_DIR/data/cuotas.csv" 'COPY staging_lopest_sheets.cuotas FROM STDIN WITH (FORMAT csv, HEADER true)'
  psql_file "$PACKAGE_DIR/sql/04_compare_one_to_one.sql"
} | tee "$OUT_FILE"

echo "[OK] Reporte guardado en: $OUT_FILE"
