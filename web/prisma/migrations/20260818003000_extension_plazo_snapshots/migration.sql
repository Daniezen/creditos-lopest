CREATE TABLE "extension_plazo_snapshots" (
  "id" TEXT NOT NULL,
  "creditoId" TEXT NOT NULL,
  "versionAlgoritmo" INTEGER NOT NULL DEFAULT 1,
  "creditoAntes" JSONB NOT NULL,
  "creditoDespues" JSONB NOT NULL,
  "eventosAntes" JSONB NOT NULL,
  "eventosDespues" JSONB NOT NULL,
  "eventosCreados" JSONB NOT NULL,
  "aplicadoEn" TIMESTAMP(3) NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPor" TEXT NOT NULL,
  "revertidoEn" TIMESTAMP(3),
  "revertidoPor" TEXT,
  "motivoReversion" TEXT,
  CONSTRAINT "extension_plazo_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "extension_plazo_snapshots_creditoId_idx" ON "extension_plazo_snapshots"("creditoId");
CREATE INDEX "extension_plazo_snapshots_aplicadoEn_idx" ON "extension_plazo_snapshots"("aplicadoEn");
CREATE INDEX "extension_plazo_snapshots_revertidoEn_idx" ON "extension_plazo_snapshots"("revertidoEn");
ALTER TABLE "extension_plazo_snapshots"
  ADD CONSTRAINT "extension_plazo_snapshots_creditoId_fkey"
  FOREIGN KEY ("creditoId") REFERENCES "creditos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
