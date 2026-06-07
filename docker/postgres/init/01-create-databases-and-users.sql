-- Inicializacion local de PostgreSQL para Creditos Lopest.
-- Crea bases y usuarios separados para evitar mezclar n8n con la app principal.

CREATE USER n8n_user WITH PASSWORD 'n8n_local_password';

-- En desarrollo local Prisma Migrate necesita crear una shadow database.
-- Por eso se concede CREATEDB solo al usuario local de la app.
-- No usar este permiso en produccion.
CREATE USER lopest_app_user WITH PASSWORD 'lopest_app_local_password' CREATEDB;

CREATE DATABASE n8n_data OWNER n8n_user;

GRANT ALL PRIVILEGES ON DATABASE n8n_data TO n8n_user;
GRANT ALL PRIVILEGES ON DATABASE lopest_core TO lopest_app_user;

\connect lopest_core
GRANT USAGE, CREATE ON SCHEMA public TO lopest_app_user;

\connect n8n_data
GRANT USAGE, CREATE ON SCHEMA public TO n8n_user;