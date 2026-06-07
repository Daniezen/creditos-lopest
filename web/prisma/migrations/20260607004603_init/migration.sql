-- AlterTable
ALTER TABLE "documentos_cliente" ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "tamanoBytes" INTEGER;

-- CreateIndex
CREATE INDEX "documentos_cliente_driveFileId_idx" ON "documentos_cliente"("driveFileId");

-- CreateIndex
CREATE INDEX "documentos_cliente_driveFolderId_idx" ON "documentos_cliente"("driveFolderId");
