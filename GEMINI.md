# GEMINI.md — Plataforma Créditos Lopest

Lopest es el sistema integral de gestión financiera de créditos, cartera de clientes, cuotas, amortizaciones, cobranza y reconciliación documental. La aplicación web principal reside en el subdirectorio `web/`.

> **Entorno:** Toda mutación financiera y documental debe ser trazable, auditable y preservar integridad transaccional en PostgreSQL.

## Fuentes y precedencia

| Contenido | Documento |
|---|---|
| Contrato universal de diseño y experiencia | `docs/design-system/universal-design-contract.md` |
| Perfil de producto y patrones visuales de Lopest | `docs/design-system/lopest-product-profile.md` |
| Esquema de base de datos y modelos de dominio | `web/prisma/schema.prisma` |
| Lógica de dominio y módulos de negocio | `web/src/features/` |
| Contratos, recetas y tokens de UI | `web/src/design-system/` |
| Contexto y especificaciones del sistema | `docs/` |
| Estado del corte y handoff | `docs/estado/handoff.md` |
| Runbook y despliegue operativo | `docs/estado/operacion.md` |

**Orden ante contradicción:** decisión aprobada explícita > esquema Prisma y migraciones vigentes > especificaciones y perfiles de diseño > código publicado > pruebas > handoff fechado > documentos históricos.

Nombra la contradicción, no la resuelvas en silencio. Distingue siempre **estado implementado** de **comportamiento aprobado**, y **código publicado** de **cambios locales sin commit**.

## Stack

Node (FNM, `.node-version`) · Next.js 16 (App Router con Turbopack) · React 19 · TypeScript 5 · Tailwind CSS 4 · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL 18 · NextAuth (`next-auth`) · Google Drive API (`googleapis`) · ExcelJS · Vitest · pnpm · Docker Compose · Caddy.

## Comandos

```bash
# Verificación estática y calidad (ejecutar en web/)
pnpm validate        # Ejecuta prisma generate, lint (ESLint), typecheck (tsc --noEmit) y next build
pnpm test            # Ejecuta la suite de pruebas unitarias y de dominio (Vitest)
pnpm lint            # Linter ESLint
pnpm exec tsc --noEmit # Verificación estricta de tipos TypeScript
pnpm build           # Build de producción Next.js

# Prisma (en web/)
pnpm exec prisma generate
pnpm exec prisma studio

# Control de versiones (en raíz)
git status --short
git diff --stat
```

**Validación y despliegue:**
Toda verificación se realiza mediante validación estática (`pnpm validate` en `web/`) y suite de pruebas (`pnpm test` en `web/`).
**Regla de verificación en vivo:** Los cambios no se prueban en modo desarrollo local (`pnpm dev`); se despliegan directamente en producción en el VPS y se verifican en la instancia en vivo.
El despliegue en VPS corre sobre Docker Compose (`docker-compose.prod.yml`) con servicios: `web` (Next.js runner), `migrate` (Prisma migrator), `postgres` (PostgreSQL 18.4) y `caddy` (reverse proxy SSL).
**Nunca `prisma migrate dev` en producción:** las migraciones se aplican con `prisma migrate deploy` a través del servicio migrator o contenedor controlado.

## Fronteras de herramientas

- **PostgreSQL**: Fuente durable de verdad para clientes, créditos, eventos financieros (cuotas/abonos), snapshots reversibles (`AbonoSnapshot`, `ExtensionPlazoSnapshot`), usuarios, roles y registros de auditoría (`AuditLog`).
- **Prisma**: Capa de tipado, consultas seguras, transacciones e integridad del esquema.
- **Next.js (App Router)**: UI reactiva, Server Actions para mutaciones transaccionales, Route Handlers para exportación a Excel (`/api/creditos/exportar-resultados`), sincronizaciones y webhooks cron (`/api/cron/...`).
- **Google Drive**: Almacenamiento externo de documentos adjuntos de clientes. Sincronización y reconciliación periódica sin eliminar registros durables en la base (`DocumentoCliente.driveDisponible`).
- **Vitest**: Validación automatizada de reglas de negocio financieras (cálculo de cuotas, amortizaciones, prórrogas, extensiones, filtros).
- **Scripts (Python/Node)**: Operaciones de mantenimiento, migraciones de datos o parches reversibles ubicados en `scripts/` y `web/scripts/`.

## Inspección dirigida (disciplina de contexto)

**Inspecciona solo los archivos de la unidad de trabajo actual.** No recorras el árbol completo, no leas archivos "por contexto" y no ejecutes búsquedas sin acotar directorio.

- Antes de buscar, acota: `web/src/`, `web/prisma/schema.prisma`, `scripts/`, la ruta concreta.
- Prefiere `grep` con patrón específico sobre lectura de archivos completos.
- **Nunca leas ni recorras:** `node_modules/`, `web/node_modules/`, `.next/`, `web/.next/`, `dist/`, `build/`, `coverage/`, `.turbo/`, `web/.turbo/`, `prisma/generated/`, `scripts/salidas/`, `scripts/backups/`, `backups/`, lockfiles (`pnpm-lock.yaml`, `package-lock.json`), archivos binarios/imágenes.
- Si una salida puede ser extensa, guárdala en archivo y muestra ruta, resumen y extractos.

## Convenciones

- Comentarios y docstrings **en inglés**, densidad alta y didáctica.
- Antes de introducir un valor visual directo, inspecciona el contrato centralizado (`web/src/design-system/`). Si la autoridad no existe, créala en el núcleo y después consúmela. **No resuelvas con valores quemados en la vista.**
- **No uses `font: inherit`** en controles nativos: restablece tamaño, peso y altura de línea de las recetas.
- Toda autorización se valida **en servidor**. `Role.code` se usa para autorizar en backend; `Role.name` para presentación. Autenticación ≠ autorización.
- Mutaciones financieras críticas (abonos, plazos, cancelaciones) deben ser **idempotentes**, atómicas mediante transacciones de Prisma y registrar snapshot de auditoría.

## Gotchas de Lopest

- La aplicación y sus dependencias residen en `web/`. Comandos de construcción, lint y test se ejecutan dentro de `web/`.
- **Propiedad y Cartera:** `Cliente.ownerUserId` representa el propietario principal/documental del cliente; `Credito.ownerUserId` representa el propietario financiero del crédito. Un mismo cliente puede tener créditos asociados a distintos propietarios.
- **Eliminación de Créditos:** La eliminación de cara al usuario es un soft-delete trazable (`eliminadoEn`, `eliminadoPor`, `motivoEliminacion`), nunca eliminación física en base de datos.
- **Reversibilidad Financiera:** Toda alteración estructural del plan de pagos (abonos a capital, extensiones de plazo) genera snapshots JSON (`AbonoSnapshot`, `ExtensionPlazoSnapshot`) que permiten auditoría completa y reversión determinista.
- **Reconciliación Google Drive:** La eliminación de un archivo en Drive no debe eliminar silenciosamente el registro en Postgres; se marca `driveDisponible = false` con fecha de verificación para preservar auditoría.

## Contrato de diseño y de permisos — regla dura

**Valores visuales.** Ningún valor visual se escribe directamente: ni color, ni espaciado, ni tipografía, ni radio, ni sombra, ni breakpoint, ni duración de transición. Se consume el token (`tokens/primitives.css`, `tokens/semantic.css`, `tokens/typography.css`) y las recetas (`recipes/*.ts`). Si la autoridad no existe, **se crea o amplía en el núcleo del contrato y después se consume** — nunca se resuelve localmente.

Esto **incluye el propio `design-system`**: un valor quemado en un archivo aislado dentro de esa carpeta es la misma violación. La única fuente de valores primitivos es la capa de fundamentos y tema (`themes/lopest.css`).

**Referencia de qué significa hacerlo bien.** Antes de crear o modificar cualquier componente o vista, inspecciona cómo lo resuelven: `/clientes`, `/clientes/[id]`, `/creditos` y `/creditos/[id]`. Ahí está el patrón vigente de centralización, dimensiones, color, jerarquía tipográfica y densidad.

**Permisos.** Ninguna condición de rol se escribe quemada como string arbitrario en la vista ni en el handler. Se valida la sesión en servidor, el alcance de propiedad (`ownerUserId`) y el rol autorizado (`Role.code`).
