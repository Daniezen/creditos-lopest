ALTER TABLE "creditos"
  ADD COLUMN IF NOT EXISTS "eliminadoEn" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eliminadoPor" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoEliminacion" TEXT;

CREATE INDEX IF NOT EXISTS "creditos_eliminadoEn_idx"
  ON "creditos"("eliminadoEn");
