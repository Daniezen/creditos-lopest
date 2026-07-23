CREATE TABLE "abono_snapshots" (
  "id" TEXT NOT NULL,
  "creditoId" TEXT NOT NULL,
  "abonoEventoId" TEXT NOT NULL,
  "versionAlgoritmo" INTEGER NOT NULL DEFAULT 1,
  "creditoAntes" JSONB NOT NULL,
  "eventosAntes" JSONB NOT NULL,
  "aplicadoEn" TIMESTAMP(3) NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPor" TEXT NOT NULL,
  CONSTRAINT "abono_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "abono_snapshots_abonoEventoId_key" ON "abono_snapshots"("abonoEventoId");
CREATE INDEX "abono_snapshots_creditoId_idx" ON "abono_snapshots"("creditoId");
CREATE INDEX "abono_snapshots_aplicadoEn_idx" ON "abono_snapshots"("aplicadoEn");
ALTER TABLE "abono_snapshots" ADD CONSTRAINT "abono_snapshots_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "creditos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abono_snapshots" ADD CONSTRAINT "abono_snapshots_abonoEventoId_fkey" FOREIGN KEY ("abonoEventoId") REFERENCES "eventos_financieros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
