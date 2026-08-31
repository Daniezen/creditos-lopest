-- CreateIndex
CREATE INDEX "eventos_financieros_estado_fechaPago_idx" ON "eventos_financieros"("estado", "fechaPago");

-- CreateIndex
CREATE INDEX "eventos_financieros_estado_fechaProgramada_idx" ON "eventos_financieros"("estado", "fechaProgramada");
