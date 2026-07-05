DO $$
DECLARE
  creditos_sin_owner_antes integer;
  creditos_actualizados integer;
  creditos_sin_owner_despues integer;
BEGIN
  SELECT COUNT(*) INTO creditos_sin_owner_antes
  FROM creditos
  WHERE "ownerUserId" IS NULL;

  UPDATE creditos cr
  SET "ownerUserId" = c."ownerUserId",
      "accionPor" = 'backfill-credit-owner-from-client'
  FROM clientes c
  WHERE cr."clienteId" = c.id
    AND cr."ownerUserId" IS NULL
    AND c."ownerUserId" IS NOT NULL;

  GET DIAGNOSTICS creditos_actualizados = ROW_COUNT;

  SELECT COUNT(*) INTO creditos_sin_owner_despues
  FROM creditos
  WHERE "ownerUserId" IS NULL;

  IF creditos_sin_owner_despues <> 0 THEN
    RAISE EXCEPTION 'Backfill incompleto. Creditos sin owner despues: %', creditos_sin_owner_despues;
  END IF;

  RAISE NOTICE 'Backfill creditos.ownerUserId OK. Sin owner antes: %, actualizados: %, sin owner despues: %',
    creditos_sin_owner_antes,
    creditos_actualizados,
    creditos_sin_owner_despues;
END $$;
