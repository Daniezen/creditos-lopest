-- Backfill capitalPagado and interesPagado for legacy imported paid cuotas
UPDATE "eventos_financieros"
SET 
  "capitalPagado" = "capitalProgramado",
  "interesPagado" = "interesProgramado"
WHERE "estado" = 'PAGADO'
  AND "tipo" = 'CUOTA_PROGRAMADA'
  AND "capitalPagado" = 0
  AND "interesPagado" = 0
  AND "montoPagado" > 0
  AND "montoPagado" = ("capitalProgramado" + "interesProgramado");
