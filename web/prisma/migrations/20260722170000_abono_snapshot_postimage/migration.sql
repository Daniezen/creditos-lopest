ALTER TABLE "abono_snapshots"
ADD COLUMN "eventosDespues" JSONB NOT NULL DEFAULT '[]'::jsonb;
