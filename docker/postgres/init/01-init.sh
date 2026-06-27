#!/bin/sh
set -e

echo "Inicializando permisos de base de datos para Lopest..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO
  \$do\$
  BEGIN
    IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = '${LOPEST_APP_USER}'
    ) THEN
      CREATE USER ${LOPEST_APP_USER}
      WITH PASSWORD '${LOPEST_APP_PASSWORD}'
      CREATEDB;
    END IF;
  END
  \$do\$;

  GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${LOPEST_APP_USER};
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  GRANT USAGE, CREATE ON SCHEMA public TO ${LOPEST_APP_USER};
  ALTER SCHEMA public OWNER TO ${LOPEST_APP_USER};
EOSQL

echo "Inicialización de PostgreSQL completada."
