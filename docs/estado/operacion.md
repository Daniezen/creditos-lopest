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

## 6. Sincronización y Tareas Programadas (Cron)

- Sincronización de documentos Drive: `POST /api/cron/documentos/sincronizar` con header de autorización `Bearer ${DOCUMENTOS_CRON_SECRET}`.
- Clasificación de cuotas vencidas y mora: `POST /api/cron/creditos/vencidas` con header `Bearer ${CREDITOS_CRON_SECRET}`.

---

**Changelog:** 30-ago-2026 — Actualización integral del runbook operativo de Lopest, incorporando jerarquía de entrega segura y recolectores de contexto.
