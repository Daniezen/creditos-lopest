# Lopest — Aplicación Web (Next.js App Router)

Módulo web interactivo y API de backend para la plataforma de gestión financiera de Créditos Lopest.

## Stack y Tecnologías

- **Framework:** Next.js 16 (App Router con Turbopack)
- **UI & Render:** React 19, Tailwind CSS 4, Lucide React
- **Lenguaje:** TypeScript 5 (estricto)
- **Base de Datos & ORM:** PostgreSQL 18 + Prisma 7 (`@prisma/adapter-pg`)
- **Autenticación:** NextAuth (`next-auth`) con Google OAuth y perfiles de sesión
- **Pruebas:** Vitest

## Estructura de Directorios

```
web/
├── prisma/
│   ├── schema.prisma          → Modelos de datos y relaciones de base de datos
│   └── migrations/            → Historial de migraciones SQL
├── src/
│   ├── app/                   → App Router: vistas (/clientes, /creditos), layouts y APIs
│   │   └── api/
│   │       ├── auth/          → Handlers de NextAuth
│   │       ├── cron/          → Tareas programadas (reconciliación Drive, mora)
│   │       └── creditos/      → Exportación de resultados a Excel
│   ├── design-system/         → Tokens CSS, recetas Tailwind y componentes base
│   ├── features/              → Módulos de dominio (clientes, créditos, abonos, plazos)
│   │   ├── clientes/          → Gestión de cartera, filtros facetados y balances
│   │   └── creditos/          → Ciclo de vida de créditos, cuotas y amortizaciones
│   ├── server/                → Servicios de infraestructura (auth guards, audit log, drive)
│   └── types/                 → Definiciones de tipos TypeScript globales
└── tests/                     → Suites de pruebas unitarias y de integración
```

## Comandos Disponibles

```bash
# Servidor de desarrollo con Turbopack
pnpm dev

# Verificación estática integral (Prisma generate + ESLint + TypeScript + Next build)
pnpm validate

# Ejecutar suite de pruebas unitarias y de dominio con Vitest
pnpm test

# Ejecutar linter ESLint
pnpm lint

# Chequeo estricto de tipos TypeScript
pnpm exec tsc --noEmit

# Compilación de producción
pnpm build

# Prisma Studio para inspección visual de la base de datos
pnpm exec prisma studio
```

## Variables de Entorno

Configurar las variables requeridas en `.env` (desarrollo) o `.env.prod` (producción):
- `DATABASE_URL`: Cadena de conexión PostgreSQL.
- `AUTH_SECRET`: Secreto criptográfico para firmas de sesión de NextAuth.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Credenciales OAuth para autenticación.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY`: Credenciales de cuenta de servicio para Google Drive.
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`: ID de carpeta raíz para almacenamiento documental.
- `DOCUMENTOS_CRON_SECRET` / `CREDITOS_CRON_SECRET`: Tokens de autorización para webhooks cron.

