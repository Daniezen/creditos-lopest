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
- El servicio `migrate` conecta con el mismo `DATABASE_URL` que la app: hoy migrator, runtime y dueño de las tablas son el mismo rol, `lopest_app_user`.
- La migración `20261125120000_audit_append_only_v1` tiene su propio procedimiento de despliegue y rollback: `docs/estado/auditoria-append-only.md`.

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
- Avisos nuevos de Casa y Negocio a Telegram: `POST /api/cron/casa-negocio-avisos` con header `Bearer ${CASA_NEGOCIO_CRON_SECRET}` (variable opcional: sin ella responde 401). Flujo `n8n/LOPEST - Avisos Casa y Negocio a Telegram.json`, activación en `docs/estado/lanzamiento-casa-negocio.md` §4.

## 8. Observabilidad

### 8.1 Registro estructurado (`web/src/server/observability/log.ts`)

Todo el servidor registra con `logEvent(nivel, evento, campos, error?)`: escribe **una línea JSON por evento** en la salida del contenedor (`docker compose … logs web`), sin agente ni servicio extra.

- `evento` es un nombre estable `dominio.que_paso` (`credito.creacion_fallida`, `drive.compensacion_fallida`, `salud.base_de_datos_no_responde`). Se filtra por él.
- Campos de correlación con el nombre de la FK en Prisma: `creditoId`, `clienteId`, `abonoEventoId`, `userId`. El valor de un log se pega tal cual en un `where`.
- Se omiten (`[omitido]`) los campos con nombre de secreto o de dato personal (`token`, `secret`, `authorization`, `cookie`, `body`, `url`, `cedula`, `email`, `telefono`, `nombre`, `direccion`…), y se borran del texto y de las trazas los Bearer, JWT, parámetros `?code=`/`?token=` y la contraseña de una URL de conexión.
- Es el único archivo de `web/src` que puede llamar a `console.*`. La prueba `web/src/server/observability/__tests__/log.test.ts` falla si aparece otro, salvo en `web/src/app/api/cron/**`, excluida **temporalmente** mientras otra rama reescribe esos handlers (al integrarla: cambiar sus `console.error` por `logEvent` y borrar la exclusión).

```bash
# Solo errores de la app, legibles
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --no-log-prefix web | grep '"nivel":"error"'
# Todo lo de un crédito
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --no-log-prefix web | grep '"creditoId":"<id>"'
```

### 8.2 Endpoint de salud `GET /api/salud`

Público (sin sesión): solo devuelve valores agregados, nunca identificadores, montos, mensajes de error ni variables de entorno. La forma exacta está fijada en `HEALTH_REPORT_KEYS` (`web/src/server/health/health-report.ts`) y una prueba falla si cambia sin revisión.

| `estado` | HTTP | Significado |
|---|---|---|
| `ok` | 200 | Base responde y los crons están al día |
| `degradado` | 200 | La app sirve, pero un cron parece atrasado |
| `caido` | 503 | La base no responde en 2 s (`SELECT 1` con timeout) |

Cómo se infieren los crons (aún no escriben un registro de ejecución):

- **Vencidas** (`/api/cron/creditos/vencidas`): cuenta cuotas `PENDIENTE` cuya fecha ya pasó el mismo corte que usa el cron. Tras una corrida es 0. Se tolera un día (`OVERDUE_BACKLOG_TOLERANCE_DAYS`) por la ventana entre medianoche y la corrida de madrugada; más allá, `degradado`. `ultimaTransicion` (máximo `actualizadoEn` con `accionPor = 'cron'`) es solo informativo: un pago posterior sobrescribe `accionPor`.
- **Sincronización Drive** (`/api/cron/documentos/sincronizar`): máximo `DocumentoCliente.driveUltimaVerificacion` (cron o reconciliación tras carga). `degradado` si supera 7 días (`DRIVE_MAX_AGE_HOURS`); ajustar cuando el horario en n8n quede fijo.
- **Versión:** `version.commit` y `version.buildTime` salen de `APP_COMMIT_SHA` y `APP_BUILD_TIME` si existen y tienen forma de hash / ISO; si no, `null`. Hoy el `Dockerfile` no las define: pasarlas como build-arg/env es una mejora pendiente.

```bash
curl -s https://<dominio>/api/salud | jq
```

> Requiere que el middleware/proxy deje `/api/salud` como ruta pública (lo hace la rama que migra `middleware.ts` → `proxy.ts`). Sin eso, la consulta sin cookie redirige a `/login`.

### 8.3 Workflows n8n de alerta (Telegram)

Copias versionadas en `n8n/` (inactivas; **no** están importadas en el n8n vivo):

| Archivo | Qué hace |
|---|---|
| `LOPEST - Salud diaria.json` | 7:00 Bogotá: `GET /api/salud` (3 intentos; un error de red también llega a la evaluación). Si no es 200 con `estado: ok`, envía el resumen por Telegram y marca la ejecución como fallida. Sin fallas, silencio. |
| `LOPEST - Alertas de errores a Telegram.json` | *Error workflow* genérico: reenvía a Telegram el workflow, nodo, mensaje y enlace de cualquier ejecución fallida que lo tenga asignado. |

El token del bot **nunca** va en el JSON: vive en la credencial n8n *Telegram Bot Lopest*. El `chat_id` es el parámetro `telegramChatId` del nodo `Set - Config` de cada workflow. Una prueba (`web/src/server/health/__tests__/health-report.test.ts`) falla si aparece un token con forma de bot o credenciales distintas de esa.

**Crear el bot (BotFather):**

1. En Telegram, abrir `@BotFather` y enviar `/newbot`.
2. Darle un nombre (p. ej. `Lopest Alertas`) y un usuario terminado en `bot` (p. ej. `lopest_alertas_bot`).
3. BotFather responde con el token (`123456789:AA…`). Guardarlo solo en n8n: *Credentials → New → Telegram API → Access Token*, con el nombre `Telegram Bot Lopest`.

**Obtener el `chat_id`:**

1. Chat privado: escribirle cualquier mensaje al bot. Grupo: agregar el bot al grupo y escribir un mensaje en él (o mencionarlo si el bot tiene *privacy mode*).
2. Consultar los mensajes recibidos por el bot (el token va solo en esta consulta local, no en un archivo ni en el historial compartido):
   ```bash
   read -rs TG_TOKEN && curl -s "https://api.telegram.org/bot${TG_TOKEN}/getUpdates" | jq '.result[].message.chat | {id, type, title}'
   ```
3. `id` es el `chat_id`: positivo para chats privados, negativo (`-100…`) para grupos y supergrupos.

**Activar:**

1. Importar ambos JSON en n8n.
2. En cada nodo de Telegram, seleccionar la credencial *Telegram Bot Lopest*.
3. En cada `Set - Config`, poner `telegramChatId`; en el de Salud diaria, también `baseUrl` (dominio público de Lopest).
4. En *Settings → Error workflow* de `LOPEST - Salud diaria` (y de los workflows de cron), elegir `LOPEST - Alertas de errores a Telegram`. Los ids cambian al importar, por eso no vienen fijados en el JSON.
5. Probar con *Manual Trigger* (por ejemplo, con un `baseUrl` inválido para forzar la alerta) y luego activar ambos.

## 9. Copias de seguridad y restauración

Hasta el 25-nov-2026 no había copias automáticas; solo dos volcados manuales de julio en `backups/` (formato SQL plano, dentro del repositorio). Desde esta sección, la copia es responsabilidad de dos scripts versionados:

| Script | Qué hace |
|---|---|
| `scripts/operacion/backup-db.sh` | `pg_dump -Fc` de `lopest_core` + roles del clúster, validación, SHA-256, retención y copia off-site opcional |
| `scripts/operacion/prueba-restauracion.sh` | Restaura una copia en un contenedor desechable sin red y la compara con producción (solo lectura) |
| `scripts/operacion/backup.env.example` | Plantilla de configuración; se copia a `~/.config/lopest-backup.env` |

### 9.1 Qué se copia y dónde

- **Destino:** `/home/deploy/backups/lopest/`, fuera del repositorio (un `git clean` o un checkout no lo tocan). Permisos `700`/`600`: los volcados contienen datos personales y financieros.
- **Cada juego** tiene tres archivos con el mismo sello, p. ej. `daily/lopest_core_20261125T170004.*`:
  - `.dump` — volcado en formato custom (comprimido; ~530 KB el 25-nov-2026).
  - `.roles.sql` — `pg_dumpall --roles-only --no-role-passwords`. Los roles son objetos globales que un volcado de una sola base **no** lleva, y todas las tablas pertenecen a `lopest_app_user`: sin este archivo, restaurar en un servidor nuevo falla por dueños. Las contraseñas no se copian; están en `.env.prod`.
  - `.sha256` — hashes de los dos anteriores, con nombres relativos (`sha256sum -c` funciona en cualquier copia).
- **Validación antes de publicar:** tamaño mínimo (50 KB), TOC legible con `pg_restore --list`, datos presentes de `clientes`, `creditos`, `eventos_financieros`, `users` y `_prisma_migrations`, y `lopest_app_user` en el archivo de roles. Hasta pasarla, el archivo se llama `.partial`.
- **Retención:** 14 diarias en `daily/` y 8 semanales en `weekly/` (la del domingo, como enlace duro: no ocupa disco extra). La poda solo corre tras una copia válida, así que una racha de fallos nunca borra las buenas.
- **Fuera de la copia:** los documentos de clientes (viven en Google Drive) y el estado de n8n (`n8n_lopest`, otra pila).

### 9.2 Por qué cron del host y no un servicio de Compose

`deploy` está en el grupo `docker` y el script ejecuta `pg_dump` **dentro de** `lopest_db`, con los binarios 18.4 del propio servidor y autenticación por socket local. Un servicio en Compose obligaría a montar el socket de Docker o a sacar la contraseña de administrador por red, a mantener un contenedor con `crond` vivo todo el día y a tocar `docker-compose.prod.yml`, que se recrea en cada despliegue. Lo que se pierde (la línea del crontab no está versionada) se compensa dejándola escrita aquí.

**Hora:** el servidor está en `Europe/Berlin` y su `cron` (Debian 3.0pl1) no admite `CRON_TZ`. `30 9 * * *` en hora del servidor son las 03:30 de Colombia en invierno europeo y las 02:30 en verano: siempre de madrugada en Bogotá.

### 9.3 Activación (una vez)

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

### 9.4 Copia off-site (desactivada por defecto)

Una copia que solo vive en la VPS muere con la VPS. `backup-db.sh` sube `daily/` y `weekly/` con `rclone copy` (nunca `sync`: borrar o cifrar el directorio local no se propaga al remoto) usando la imagen fijada `rclone/rclone:1.68.2`, sin instalar nada en el host. Se activa con:

```bash
mkdir -p ~/.config/rclone
docker run --rm -it -v ~/.config/rclone:/config/rclone rclone/rclone:1.68.2 config   # crear remoto "gdrive" (Google Drive) o "b2"
# en ~/.config/lopest-backup.env:
#   OFFSITE_REMOTE=gdrive:Backups/lopest
```

Recomendación: **Backblaze B2** con una llave restringida al bucket (`listFiles` + `writeFiles`, sin `deleteFiles`) y bloqueo de objetos, como en Impulsa; así ni un atacante con la VPS puede borrar las copias. Google Drive es más simple porque Lopest ya lo usa, pero el token OAuth de rclone puede borrar todo el Drive. El remoto crece ~0,5 MB/día y se poda a mano o con la retención del proveedor.

### 9.5 Prueba de restauración

```bash
bash /home/deploy/apps/lopest/scripts/operacion/prueba-restauracion.sh                 # última diaria
bash /home/deploy/apps/lopest/scripts/operacion/prueba-restauracion.sh <ruta>.dump    # una concreta
```

Verifica el SHA-256, levanta `postgres:18.4-alpine` (la imagen de `lopest_db`) con `--network none`, aplica el archivo de roles, restaura **con dueños** (el mismo camino que una restauración real) y compara con producción el registro `_prisma_migrations` (nombre, checksum, terminada) y el conteo exacto de filas de todas las tablas de `public` y `staging_lopest_sheets`. Las consultas a producción corren con `default_transaction_read_only=on`. Migraciones o conjunto de tablas distintos = `FALLO` (código 1); las filas pueden diferir solo por lo que cambió después del volcado y se listan con su delta. Una `trap` borra el contenedor al salir, con éxito o con fallo.

**Frecuencia:** semanal por cron (lunes, línea de §9.3) y además a mano tras cada migración de Prisma, cada cambio de versión de PostgreSQL y antes de cualquier operación destructiva.

**Corrida del 25-nov-2026** sobre `lopest_core_20261125T170004.dump` (532 KB): SHA-256 OK, `pg_restore` código 0, dueño `lopest_app_user`, 17/17 migraciones idénticas y las 16 tablas con el mismo número de filas (`clientes` 195, `creditos` 577, `eventos_financieros` 3311, `audit_logs` 1437, `documentos_cliente` 511…). Resultado: **OK**.

### 9.6 Restauración real paso a paso

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
- 25-nov-2026 — Añadida §8: logger estructurado, `/api/salud` y workflows n8n de salud diaria y alertas por Telegram.
- 25-nov-2026 — Añadida §9: backups automáticos (`scripts/operacion/backup-db.sh`), copia off-site opcional, prueba de restauración y procedimiento de restauración real.
- 31-ago-2026 — Incorporación de comandos operativos para inspección de logs y contenedores de producción.
