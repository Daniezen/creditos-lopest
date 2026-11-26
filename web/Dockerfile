# ============================================================================
# Dockerfile producción - App Next.js autocontenida en /web
# ============================================================================
#
# Build context:
#   Lopest/web
#
# Dockerfile:
#   Lopest/web/Dockerfile
#
# Stages:
# - deps: instala dependencias.
# - builder: genera Prisma Client y compila Next.js.
# - migrator: imagen para ejecutar prisma migrate deploy.
# - runner: runtime mínimo para Next standalone.
#
# Decisiones:
# - No existe package.json raíz.
# - La app Node real vive en /web.
# - DATABASE_URL real se inyecta en runtime desde docker-compose.prod.yml.
# - DATABASE_URL dummy solo existe durante build para Prisma generate/build.
# ============================================================================

FROM node:24-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# ----------------------------------------------------------------------------
# Dependencias
# ----------------------------------------------------------------------------
FROM base AS deps

RUN corepack enable
RUN corepack prepare pnpm@10.23.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

RUN pnpm install --frozen-lockfile

# ----------------------------------------------------------------------------
# Build de Next.js
# ----------------------------------------------------------------------------
FROM base AS builder

RUN corepack enable
RUN corepack prepare pnpm@10.23.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# URL dummy deliberada para build.
# No es secreto. No apunta a la base real.
ARG PRISMA_GENERATE_DATABASE_URL="postgresql://lopest_app_user:dummy_password@localhost:5432/lopest_core?schema=public"

# Prisma 7 carga prisma.config.ts durante prisma generate.
# prisma generate necesita que DATABASE_URL exista, pero no necesita conectarse
# a la base real para generar Prisma Client.
RUN DATABASE_URL="${PRISMA_GENERATE_DATABASE_URL}" pnpm exec prisma generate

# `pnpm build` corre primero scripts/versiones/check-changelog.mjs: un
# CHANGELOG.md mal formado detiene aquí la imagen (docs/specs/versiones.md §6).
# Next build puede cargar módulos server-side que importan Prisma.
# Mantener DATABASE_URL dummy aquí evita acoplar el build a la base real.
# Same heap as `pnpm validate` (scripts/validate.mjs): with Node's default
# ceiling `next build` dies of "heap out of memory" since Casa y Negocio
# landed. 3.5 GB fits the VPS next to Postgres, n8n and the live app.
ARG BUILD_NODE_OPTIONS="--max-old-space-size=3584"
RUN NODE_OPTIONS="${BUILD_NODE_OPTIONS}" DATABASE_URL="${PRISMA_GENERATE_DATABASE_URL}" pnpm build

# ----------------------------------------------------------------------------
# Migraciones Prisma
# ----------------------------------------------------------------------------
FROM base AS migrator

RUN corepack enable
RUN corepack prepare pnpm@10.23.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY scripts ./scripts

# Prisma Client también debe existir en la imagen migrator porque esta imagen
# ejecuta scripts operativos como create-user, no solo prisma migrate deploy.
ARG PRISMA_GENERATE_DATABASE_URL="postgresql://lopest_app_user:dummy_password@localhost:5432/lopest_core?schema=public"
RUN DATABASE_URL="${PRISMA_GENERATE_DATABASE_URL}" pnpm exec prisma generate

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ----------------------------------------------------------------------------
# Runtime Next.js standalone
# ----------------------------------------------------------------------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Version history read at runtime by src/server/versiones (cwd = /app, beside
# server.js). Copied explicitly because the standalone trace does not include
# files read with fs; without it the app keeps working and hides the version.
# `pnpm build` already validated it (scripts/versiones/check-changelog.mjs).
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]