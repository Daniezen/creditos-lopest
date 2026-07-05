DO $$
DECLARE
  creditos_sin_owner integer;
BEGIN
  SELECT COUNT(*) INTO creditos_sin_owner
  FROM creditos
  WHERE "ownerUserId" IS NULL;

  IF creditos_sin_owner <> 0 THEN
    RAISE EXCEPTION 'Todavia existen creditos sin ownerUserId: %', creditos_sin_owner;
  END IF;

  RAISE NOTICE 'Credit owner validation OK. Todos los creditos tienen ownerUserId.';
END $$;

SELECT
  u.email,
  u.nombre,
  COUNT(cr.id) AS creditos
FROM users u
LEFT JOIN creditos cr ON cr."ownerUserId" = u.id
GROUP BY u.id, u.email, u.nombre
ORDER BY creditos DESC, u.email ASC;
