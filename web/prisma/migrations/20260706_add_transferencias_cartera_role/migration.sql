INSERT INTO roles (id, code, name, "creadoEn", "actualizadoEn")
VALUES ('role_transferencias_cartera', 'TRANSFERENCIAS_CARTERA', 'Transferencias de cartera', now(), now())
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    "actualizadoEn" = now();
