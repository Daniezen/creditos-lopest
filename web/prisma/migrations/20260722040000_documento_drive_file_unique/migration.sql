-- Additive integrity guarantee for idempotent Drive inventory and retries.
CREATE UNIQUE INDEX "documentos_cliente_driveFileId_key"
ON "documentos_cliente"("driveFileId");
