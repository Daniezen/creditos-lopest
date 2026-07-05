DO $$
DECLARE
  clientes_sin_owner integer;
  padre_clientes integer;
  madre_clientes integer;
BEGIN
  SELECT COUNT(*) INTO clientes_sin_owner
  FROM clientes
  WHERE "ownerUserId" IS NULL;

  IF clientes_sin_owner <> 0 THEN
    RAISE EXCEPTION 'Todavia existen clientes sin ownerUserId: %', clientes_sin_owner;
  END IF;

  SELECT COUNT(*) INTO padre_clientes
  FROM clientes c
  JOIN users u ON u.id = c."ownerUserId"
  WHERE lower(u.email) = 'lopestdcm@gmail.com';

  SELECT COUNT(*) INTO madre_clientes
  FROM clientes c
  JOIN users u ON u.id = c."ownerUserId"
  WHERE lower(u.email) = 'marthadcg@gmail.com';

  RAISE NOTICE 'Owner validation OK. Clientes padre: %, clientes madre: %', padre_clientes, madre_clientes;
END $$;
