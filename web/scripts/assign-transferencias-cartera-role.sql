DO $$
DECLARE
  padre_email text := 'lopestdcm@gmail.com';
  padre_id text;
  transfer_role_id text;
BEGIN
  SELECT id INTO padre_id
  FROM users
  WHERE lower(email) = padre_email
    AND activo = true;

  IF padre_id IS NULL THEN
    RAISE EXCEPTION 'No existe usuario padre activo con email %', padre_email;
  END IF;

  SELECT id INTO transfer_role_id
  FROM roles
  WHERE code = 'TRANSFERENCIAS_CARTERA';

  IF transfer_role_id IS NULL THEN
    RAISE EXCEPTION 'No existe rol TRANSFERENCIAS_CARTERA. Ejecuta primero la migracion del rol.';
  END IF;

  INSERT INTO user_roles ("userId", "roleId", "creadoEn")
  VALUES (padre_id, transfer_role_id, now())
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  RAISE NOTICE 'Rol TRANSFERENCIAS_CARTERA asignado a %', padre_email;
END $$;
