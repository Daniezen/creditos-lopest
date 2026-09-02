-- Recalculate days of delay for all overdue and mora installments according to current Colombia date
UPDATE "eventos_financieros"
SET "diasAtraso" = GREATEST(0, ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - "fechaProgramada"::date))
WHERE "estado" IN ('ATRASADO', 'MORA');
