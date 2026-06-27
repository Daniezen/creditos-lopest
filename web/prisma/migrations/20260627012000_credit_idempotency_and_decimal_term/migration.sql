-- Corrige dos problemas estructurales antes de permitir guardar créditos reales.
--
-- 1. idempotencyKey evita duplicados por doble submit/reintentos.
-- 2. plazoMeses como Decimal permite conservar plazos como 2.5 meses,
--    que el motor financiero ya soporta para quincenas.

ALTER TABLE "creditos"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "creditos_idempotencyKey_key"
ON "creditos"("idempotencyKey");

ALTER TABLE "creditos"
ALTER COLUMN "plazoMeses" TYPE DECIMAL(10, 2)
USING "plazoMeses"::DECIMAL(10, 2);
