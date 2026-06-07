import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton.
 *
 * En desarrollo, Next.js puede recargar módulos varias veces por HMR.
 * Si se instancia PrismaClient en cada recarga, se abren conexiones innecesarias.
 *
 * Este patrón conserva una instancia global durante desarrollo y evita
 * saturar PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}