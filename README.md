# Plataforma Créditos Lopest

Sistema integral de gestión financiera de créditos, cartera de clientes, planes de amortización, cobranza, snapshots reversibles y reconciliación documental con Google Drive.

## Stack tecnológico

- **Frontend & Backend API:** Next.js 16 (App Router con Turbopack), React 19, TypeScript 5, Tailwind CSS 4.
- **Base de datos & ORM:** PostgreSQL 18 (Alpine), Prisma 7 (`@prisma/adapter-pg`).
- **Autenticación & Auditoría:** NextAuth (`next-auth`), eventos transaccionales inmutables en `AuditLog`.
- **Integraciones:** Google Drive API (`googleapis`) para gestión documental, `exceljs` para exportación de cartera.
- **Testing & Calidad:** Vitest, ESLint, TypeScript (`tsc --noEmit`).
- **Infraestructura & Despliegue:** Docker Compose, Caddy 2 (reverse proxy SSL automático).

## Estructura del repositorio

```
lopest/
├── docs/                 → Documentación canónica, specs funcionales y contratos de diseño
│   ├── README-documentacion.md → Índice maestro y taxonomía de documentación
│   ├── contexto-canonico.md    → Reglas estables y arquitectura de dominio
│   ├── design-system/          → Contrato universal y perfil visual de Lopest
│   ├── specs/                  → Especificaciones funcionales por módulo
│   └── estado/                 → Handoff del corte, plan de ejecución y runbook
├── web/                  → Aplicación web Next.js
│   ├── prisma/           → Esquema de base de datos y migraciones
│   └── src/
│       ├── app/          → App Router (rutas, layouts, route handlers y crons)
│       ├── design-system/→ Tokens de diseño, temas y recetas
│       ├── features/     → Lógica de dominio (clientes, créditos, abonos, plazos)
│       └── server/       → Servicios de backend (auth, auditoría, Google Drive)
├── scripts/              → Herramientas de mantenimiento, recolección y parches
└── docker-compose.prod.yml → Orquestación productiva en VPS
```

## Comandos de desarrollo y validación

Todos los comandos de construcción, calidad y pruebas se ejecutan dentro del subdirectorio `web/`:

```bash
cd web

# Validación estática completa (Prisma generate + ESLint + Typecheck + Next.js build)
pnpm validate

# Suite de pruebas unitarias y de dominio (Vitest)
pnpm test

# Servidor de desarrollo local
pnpm dev
```

## Despliegue en producción (VPS)

El entorno productivo opera mediante contenedores Docker:

```bash
# Validar migraciones pendientes
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate

# Recompilar y levantar el servicio web
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --force-recreate web
```

## Documentación del sistema

Para consultar las especificaciones funcionales, reglas de negocio y contratos de diseño, consulta el [Índice Maestro de Documentación](docs/README-documentacion.md).
