-- Migra la autenticación interna por contraseña hacia OAuth Google.
-- Mantiene User/Role/UserRole/AuditLog como capa interna de autorización/auditoría.

ALTER TABLE "users"
ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "oauth_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "pictureUrl" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_providerAccountId_key"
ON "oauth_accounts"("provider", "providerAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_accounts_provider_email_key"
ON "oauth_accounts"("provider", "email");

CREATE INDEX IF NOT EXISTS "oauth_accounts_userId_idx"
ON "oauth_accounts"("userId");

CREATE INDEX IF NOT EXISTS "oauth_accounts_email_idx"
ON "oauth_accounts"("email");

ALTER TABLE "oauth_accounts"
ADD CONSTRAINT "oauth_accounts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS "sessions";
