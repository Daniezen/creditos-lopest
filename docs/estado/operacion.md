# Operación, Despliegue y Entrega Segura

```
ESTADO:    Durable — reglas operativas y protocolos de entrega vigentes
CORTE:     30-ago-2026
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

---

**Changelog:** 25-nov-2026 — Sección 8: logger estructurado, `/api/salud` y workflows n8n de salud diaria y alertas por Telegram. 31-ago-2026 — Incorporación de comandos operativos para inspección de logs y contenedores de producción.
