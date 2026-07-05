ALTER TABLE "creditos"
ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "creditos_ownerUserId_idx"
ON "creditos"("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creditos_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "creditos"
    ADD CONSTRAINT "creditos_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId")
    REFERENCES "users"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END $$;
