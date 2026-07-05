ALTER TABLE "clientes"
ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "clientes_ownerUserId_idx"
ON "clientes"("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clientes_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "clientes"
    ADD CONSTRAINT "clientes_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId")
    REFERENCES "users"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;
