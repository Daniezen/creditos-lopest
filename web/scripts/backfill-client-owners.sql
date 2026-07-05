DO $$
DECLARE
  admin_email text := 'thedanielfle@gmail.com';
  padre_email text := 'lopestdcm@gmail.com';
  madre_email text := 'marthadcg@gmail.com';

  admin_id text;
  padre_id text;
  madre_id text;
  admin_role_id text;
  operador_role_id text;
  clientes_sin_owner_antes integer;
  clientes_actualizados integer;
  clientes_sin_owner_despues integer;
BEGIN
  SELECT id INTO admin_id
  FROM users
  WHERE lower(email) = admin_email AND activo = true;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No existe usuario ADMIN activo con email %', admin_email;
  END IF;

  SELECT id INTO padre_id
  FROM users
  WHERE lower(email) = padre_email AND activo = true;

  IF padre_id IS NULL THEN
    RAISE EXCEPTION 'No existe usuario PADRE activo con email %', padre_email;
  END IF;

  SELECT id INTO madre_id
  FROM users
  WHERE lower(email) = madre_email AND activo = true;

  IF madre_id IS NULL THEN
    RAISE EXCEPTION 'No existe usuario MADRE activo con email %', madre_email;
  END IF;

  INSERT INTO roles (id, code, name, "creadoEn", "actualizadoEn")
  VALUES ('role_admin', 'ADMIN', 'Administrador', now(), now())
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      "actualizadoEn" = now();

  INSERT INTO roles (id, code, name, "creadoEn", "actualizadoEn")
  VALUES ('role_operador', 'OPERADOR', 'Operador', now(), now())
  ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      "actualizadoEn" = now();

  SELECT id INTO admin_role_id FROM roles WHERE code = 'ADMIN';
  SELECT id INTO operador_role_id FROM roles WHERE code = 'OPERADOR';

  INSERT INTO user_roles ("userId", "roleId", "creadoEn")
  VALUES (admin_id, admin_role_id, now())
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO user_roles ("userId", "roleId", "creadoEn")
  VALUES (padre_id, operador_role_id, now())
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO user_roles ("userId", "roleId", "creadoEn")
  VALUES (madre_id, operador_role_id, now())
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  SELECT COUNT(*) INTO clientes_sin_owner_antes
  FROM clientes
  WHERE "ownerUserId" IS NULL;

  UPDATE clientes
  SET "ownerUserId" = padre_id,
      "accionPor" = 'backfill-owner-padre'
  WHERE "ownerUserId" IS NULL;

  GET DIAGNOSTICS clientes_actualizados = ROW_COUNT;

  SELECT COUNT(*) INTO clientes_sin_owner_despues
  FROM clientes
  WHERE "ownerUserId" IS NULL;

  IF clientes_sin_owner_despues <> 0 THEN
    RAISE EXCEPTION 'Backfill incompleto. Clientes sin owner despues: %', clientes_sin_owner_despues;
  END IF;

  RAISE NOTICE 'Backfill ownerUserId OK. Sin owner antes: %, actualizados: %, sin owner despues: %',
    clientes_sin_owner_antes,
    clientes_actualizados,
    clientes_sin_owner_despues;
END $$;
