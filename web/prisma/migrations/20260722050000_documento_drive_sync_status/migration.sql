ALTER TABLE "documentos_cliente"
ADD COLUMN "driveDisponible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "driveUltimaVerificacion" TIMESTAMP(3),
ADD COLUMN "driveEliminadoEn" TIMESTAMP(3);

CREATE INDEX "documentos_cliente_driveDisponible_idx"
ON "documentos_cliente"("driveDisponible");
