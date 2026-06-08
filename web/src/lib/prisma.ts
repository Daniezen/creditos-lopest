import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma singleton para Next.js.
 *
 * Prisma 7 con engine "client" requiere un driver adapter en runtime.
 * Para PostgreSQL local usamos @prisma/adapter-pg.
 *
 * prisma.config.ts configura Prisma CLI / Migrate.
 * Este archivo configura Prisma Client dentro de la aplicación Next.js.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definida. Revisa el archivo .env en la raíz de web.",
  );
}

const adapter = new PrismaPg({
  connectionString,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}