# Operación, Despliegue y Entrega Segura

```
ESTADO:    Durable — reglas operativas y protocolos de entrega vigentes
CORTE:     25-nov-2026
```

Runbook operativo de Plataforma Créditos Lopest. No contiene el estado volátil del corte (eso reside en `estado/handoff.md`) ni la metodología general abstracta (skills del sistema).

## 1. Entornos e Infraestructura

| Elemento | Configuración / Ruta |
|---|---|
| Repositorio local / CWD | `/home/deploy/apps/lopest` |
| Subdirectorio de Aplicación | `web/` |
| Rama principal | `main` |
| VPS Runner | Docker Compose (`docker-compose.prod.yml`) |
| Base de datos | PostgreSQL 18.4 Alpine (`lopest_db` en red `lopest_internal`) |
| Reverse Proxy SSL | Caddy 2 Alpine (`lopest_caddy`, puertos 80/443) |
| Archivo de variables productivas | `.env.prod` |

## 2. Validación Estática y Calidad

Antes de cualquier entrega o despliegue, ejecutar dentro de `web/`:

```bash
cd /home/deploy/apps/lopest/web

# Validación integral en cadena (Prisma generate + ESLint + TypeScript + Next.js build)
pnpm validate

# Suite de pruebas automatizadas (Vitest)
pnpm test
```

## 3. Protocolo de Entrega de Cambios y Recolección de Contexto

Para minimizar el consumo de tokens y asegurar modificaciones libres de regresiones:

### Jerarquía de entrega de cambios
1. **Edición Directa / Herramientas del Agente:** Preferida por defecto (`replace_file_content` o escritura directa de archivos). Evita corrupción de caracteres y escapes.
2. **Aplicadores Python Validados (`scripts/aplicar_*.py`):** Para refactorizaciones medianas, estructurales o multilínea.
   - Deben validar anclajes únicos semánticos antes de modificar ningún byte. Si un anclaje no coincide exactamente una vez, el script se detiene sin alterar el archivo.
   - Aplican escrituras atómicas y reportan exactamente las rutas modificadas.
   - No dejan copias residuales ni archivos `.bak-*`.
3. **Recolectores de Contexto (`scripts/recolectar_*.py`):**
   - Scripts de solo lectura para extraer extractos focalizados con patrones semánticos hacia `scripts/salidas/`.
   - Evitan volcar archivos completos de miles de líneas en la conversación, optimizando la ventana de contexto.
4. **Heredoc / EOF en Bash:** Reservado exclusivamente como fallback de bajo nivel para inicializaciones o configuraciones breves de terminal.

## 4. Migraciones de Base de Datos

- **Nunca `prisma migrate dev` en producción.**
- Las migraciones se aplican con:
  ```bash
  docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate
  ```
  o mediante `pnpm exec prisma migrate deploy` dentro de `web/` apuntando a la base de datos de producción con variables controladas.

## 5. Despliegue en VPS y Verificación en Vivo

> **Regla de verificación:** La visualización y validación de cambios se realiza exclusivamente tras el despliegue en producción en el VPS (mediante Docker Compose y Caddy), no en modo desarrollo local (`pnpm dev`). Todo cambio debe ser validado estáticamente (`pnpm validate`), verificado con la suite de pruebas (`pnpm test`), commiteado, pusheado y desplegado mediante `docker compose up -d --build web`.

```bash
cd /home/deploy/apps/lopest
git status --short
git diff --stat
git add -A
git commit -m "feat/fix: descripción focal"
git push origin main
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --force-recreate web
```

## 6. Inspección de Contenedores y Diagnóstico de Errores (Logs)

Para auditar excepciones de Server Actions, errores 500 o fallos de infraestructura en la VPS:

```bash
# Ver estado de los contenedores
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

# Logs con timestamp del runner Next.js (web)
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -t --tail=100 -f web

# Logs de PostgreSQL
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 postgres

# Logs de Caddy (Reverse Proxy SSL)
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 caddy
```

## 7. Sincronización y Tareas Programadas (Cron)

- Sincronización de documentos Drive: `POST /api/cron/documentos/sincronizar` con header de autorización `Bearer ${DOCUMENTOS_CRON_SECRET}`.
- Clasificación de cuotas vencidas y mora: `POST /api/cron/creditos/vencidas` con header `Bearer ${CREDITOS_CRON_SECRET}`.


## 8. Copias de seguridad y restauración

Hasta el 25-nov-2026 no había copias automáticas; solo dos volcados manuales de julio en `backups/` (formato SQL plano, dentro del repositorio). Desde esta sección, la copia es responsabilidad de dos scripts versionados:

| Script | Qué hace |
|---|---|
| `scripts/operacion/backup-db.sh` | `pg_dump -Fc` de `lopest_core` + roles del clúster, validación, SHA-256, retención y copia off-site opcional |
| `scripts/operacion/prueba-restauracion.sh` | Restaura una copia en un contenedor desechable sin red y la compara con producción (solo lectura) |
| `scripts/operacion/backup.env.example` | Plantilla de configuración; se copia a `~/.config/lopest-backup.env` |

### 8.1 Qué se copia y dónde

- **Destino:** `/home/deploy/backups/lopest/`, fuera del repositorio (un `git clean` o un checkout no lo tocan). Permisos `700`/`600`: los volcados contienen datos personales y financieros.
- **Cada juego** tiene tres archivos con el mismo sello, p. ej. `daily/lopest_core_20261125T170004.*`:
  - `.dump` — volcado en formato custom (comprimido; ~530 KB el 25-nov-2026).
  - `.roles.sql` — `pg_dumpall --roles-only --no-role-passwords`. Los roles son objetos globales que un volcado de una sola base **no** lleva, y todas las tablas pertenecen a `lopest_app_user`: sin este archivo, restaurar en un servidor nuevo falla por dueños. Las contraseñas no se copian; están en `.env.prod`.
  - `.sha256` — hashes de los dos anteriores, con nombres relativos (`sha256sum -c` funciona en cualquier copia).
- **Validación antes de publicar:** tamaño mínimo (50 KB), TOC legible con `pg_restore --list`, datos presentes de `clientes`, `creditos`, `eventos_financieros`, `users` y `_prisma_migrations`, y `lopest_app_user` en el archivo de roles. Hasta pasarla, el archivo se llama `.partial`.
- **Retención:** 14 diarias en `daily/` y 8 semanales en `weekly/` (la del domingo, como enlace duro: no ocupa disco extra). La poda solo corre tras una copia válida, así que una racha de fallos nunca borra las buenas.
- **Fuera de la copia:** los documentos de clientes (viven en Google Drive) y el estado de n8n (`n8n_lopest`, otra pila).

### 8.2 Por qué cron del host y no un servicio de Compose

`deploy` está en el grupo `docker` y el script ejecuta `pg_dump` **dentro de** `lopest_db`, con los binarios 18.4 del propio servidor y autenticación por socket local. Un servicio en Compose obligaría a montar el socket de Docker o a sacar la contraseña de administrador por red, a mantener un contenedor con `crond` vivo todo el día y a tocar `docker-compose.prod.yml`, que se recrea en cada despliegue. Lo que se pierde (la línea del crontab no está versionada) se compensa dejándola escrita aquí.

**Hora:** el servidor está en `Europe/Berlin` y su `cron` (Debian 3.0pl1) no admite `CRON_TZ`. `30 9 * * *` en hora del servidor son las 03:30 de Colombia en invierno europeo y las 02:30 en verano: siempre de madrugada en Bogotá.

### 8.3 Activación (una vez)

```bash
mkdir -p /home/deploy/backups/lopest && chmod 700 /home/deploy/backups/lopest
cp /home/deploy/apps/lopest/scripts/operacion/backup.env.example ~/.config/lopest-backup.env && chmod 600 ~/.config/lopest-backup.env
crontab -e
```

Líneas del crontab de `deploy`:

```
MAILTO=""
30 9 * * * /home/deploy/apps/lopest/scripts/operacion/backup-db.sh >> /home/deploy/backups/lopest/backup.log 2>&1
0 10 * * 1 /home/deploy/apps/lopest/scripts/operacion/prueba-restauracion.sh >> /home/deploy/backups/lopest/prueba-restauracion.log 2>&1
```

Comprobar después de la primera noche:

```bash
cat /home/deploy/backups/lopest/ESTADO          # "OK <fecha> <archivo>" o "FALLO ..."
journalctl -t lopest-backup --since yesterday   # éxitos y fallos de copia y prueba
tail -n 20 /home/deploy/backups/lopest/backup.log
```

**Fallo ruidoso:** cualquier error aborta con código ≠ 0, escribe `FALLO` en `ESTADO`, deja una línea de prioridad `err` en syslog (`lopest-backup`) y, si `HEALTHCHECK_URL` está definida, llama a `<url>/fail`. Sin servicio de latido externo, **un servidor caído no avisa de nada**: se recomienda activar `HEALTHCHECK_URL` (healthchecks.io gratuito o Better Stack) para que la ausencia de copia llegue por correo.

### 8.4 Copia off-site (desactivada por defecto)

Una copia que solo vive en la VPS muere con la VPS. `backup-db.sh` sube `daily/` y `weekly/` con `rclone copy` (nunca `sync`: borrar o cifrar el directorio local no se propaga al remoto) usando la imagen fijada `rclone/rclone:1.68.2`, sin instalar nada en el host. Se activa con:

```bash
mkdir -p ~/.config/rclone
docker run --rm -it -v ~/.config/rclone:/config/rclone rclone/rclone:1.68.2 config   # crear remoto "gdrive" (Google Drive) o "b2"
# en ~/.config/lopest-backup.env:
#   OFFSITE_REMOTE=gdrive:Backups/lopest
```

Recomendación: **Backblaze B2** con una llave restringida al bucket (`listFiles` + `writeFiles`, sin `deleteFiles`) y bloqueo de objetos, como en Impulsa; así ni un atacante con la VPS puede borrar las copias. Google Drive es más simple porque Lopest ya lo usa, pero el token OAuth de rclone puede borrar todo el Drive. El remoto crece ~0,5 MB/día y se poda a mano o con la retención del proveedor.

### 8.5 Prueba de restauración

```bash
bash /home/deploy/apps/lopest/scripts/operacion/prueba-restauracion.sh                 # última diaria
bash /home/deploy/apps/lopest/scripts/operacion/prueba-restauracion.sh <ruta>.dump    # una concreta
```

Verifica el SHA-256, levanta `postgres:18.4-alpine` (la imagen de `lopest_db`) con `--network none`, aplica el archivo de roles, restaura **con dueños** (el mismo camino que una restauración real) y compara con producción el registro `_prisma_migrations` (nombre, checksum, terminada) y el conteo exacto de filas de todas las tablas de `public` y `staging_lopest_sheets`. Las consultas a producción corren con `default_transaction_read_only=on`. Migraciones o conjunto de tablas distintos = `FALLO` (código 1); las filas pueden diferir solo por lo que cambió después del volcado y se listan con su delta. Una `trap` borra el contenedor al salir, con éxito o con fallo.

**Frecuencia:** semanal por cron (lunes, línea de §8.3) y además a mano tras cada migración de Prisma, cada cambio de versión de PostgreSQL y antes de cualquier operación destructiva.

**Corrida del 25-nov-2026** sobre `lopest_core_20261125T170004.dump` (532 KB): SHA-256 OK, `pg_restore` código 0, dueño `lopest_app_user`, 17/17 migraciones idénticas y las 16 tablas con el mismo número de filas (`clientes` 195, `creditos` 577, `eventos_financieros` 3311, `audit_logs` 1437, `documentos_cliente` 511…). Resultado: **OK**.

### 8.6 Restauración real paso a paso

Restaurar a una base nueva y luego intercambiar nombres: la base actual queda intacta como plan de vuelta atrás. Variables de ejemplo:

```bash
cd /home/deploy/apps/lopest
C="docker compose --env-file .env.prod -f docker-compose.prod.yml"
SET=/home/deploy/backups/lopest/daily/lopest_core_AAAAMMDDTHHMMSS   # sin extensión
```

1. **Elegir y verificar la copia:** `(cd "$(dirname $SET)" && sha256sum -c "$(basename $SET).sha256")`. Si viene del off-site, bajarla con rclone y verificar igual.
2. **Detener escrituras:** `$C stop web`. (n8n está en otra red y no conecta directo a la base.)
3. **Copia del estado actual**, aunque esté dañado: `bash scripts/operacion/backup-db.sh`.
4. **Solo en servidor nuevo / volumen vacío:** `$C up -d postgres`, luego roles y contraseña:
   ```bash
   docker exec -i lopest_db sh -c 'psql -U "$POSTGRES_USER" -d postgres' < $SET.roles.sql   # "already exists" para lopest_admin es normal
   docker exec -it lopest_db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER ROLE lopest_app_user PASSWORD '\''<LOPEST_APP_PASSWORD de .env.prod>'\''"'
   ```
5. **Restaurar en una base nueva:**
   ```bash
   docker exec lopest_db sh -c 'createdb -U "$POSTGRES_USER" lopest_core_restaurada'
   docker exec lopest_db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "GRANT ALL ON DATABASE lopest_core_restaurada TO lopest_app_user"'
   docker exec -i lopest_db sh -c 'pg_restore -U "$POSTGRES_USER" -d lopest_core_restaurada --exit-on-error' < $SET.dump
   ```
6. **Revisar** conteos clave en `lopest_core_restaurada` (las mismas consultas de la prueba).
7. **Intercambiar** (con `web` detenido no hay conexiones; si las hay, `pg_terminate_backend`):
   ```bash
   docker exec lopest_db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "ALTER DATABASE lopest_core RENAME TO lopest_core_old_$(date +%Y%m%d)" -c "ALTER DATABASE lopest_core_restaurada RENAME TO lopest_core"'
   ```
8. **Migraciones pendientes** si la copia es anterior al código desplegado: `$C run --rm migrate`.
9. **Arrancar y verificar:** `$C up -d web`, revisar logs (§6) y entrar a la aplicación.
10. Pasados unos días sin incidencias, borrar `lopest_core_old_*` con `DROP DATABASE`.

---

**Changelog:**
- 25-nov-2026 — Añadida §8: backups automáticos (`scripts/operacion/backup-db.sh`), copia off-site opcional, prueba de restauración y procedimiento de restauración real.
- 31-ago-2026 — Incorporación de comandos operativos para inspección de logs y contenedores de producción.
