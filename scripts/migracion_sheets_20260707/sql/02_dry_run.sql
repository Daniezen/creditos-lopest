\echo '=== STAGING COUNTS ==='
SELECT 'clientes_staging' AS metric, COUNT(*) FROM staging_lopest_sheets.clientes
UNION ALL SELECT 'creditos_staging', COUNT(*) FROM staging_lopest_sheets.creditos
UNION ALL SELECT 'cuotas_staging', COUNT(*) FROM staging_lopest_sheets.cuotas;

\echo '=== CURRENT DB COUNTS ==='
SELECT 'clientes_db' AS metric, COUNT(*) FROM clientes
UNION ALL SELECT 'creditos_db', COUNT(*) FROM creditos
UNION ALL SELECT 'eventos_db', COUNT(*) FROM eventos_financieros;

\echo '=== DUPLICADOS EN EXCEL ==='
SELECT 'cedula_cliente_duplicada' AS issue, cedula AS key, COUNT(*) AS count
FROM staging_lopest_sheets.clientes
GROUP BY cedula
HAVING COUNT(*) > 1
UNION ALL
SELECT 'codigo_credito_duplicado', id_credito, COUNT(*)
FROM staging_lopest_sheets.creditos
GROUP BY id_credito
HAVING COUNT(*) > 1
UNION ALL
SELECT 'codigo_cuota_evento_duplicado', id_cuota, COUNT(*)
FROM staging_lopest_sheets.cuotas
GROUP BY id_cuota
HAVING COUNT(*) > 1
ORDER BY issue, key;

\echo '=== CREDITOS EN STAGING SIN CLIENTE EN STAGING ==='
SELECT id_credito, cedula, cliente
FROM staging_lopest_sheets.creditos c
WHERE NOT EXISTS (
  SELECT 1 FROM staging_lopest_sheets.clientes cl WHERE cl.cedula = c.cedula
)
ORDER BY id_credito
LIMIT 100;

\echo '=== CUOTAS EN STAGING SIN CREDITO EN STAGING ==='
SELECT id_cuota, id_credito, cliente
FROM staging_lopest_sheets.cuotas q
WHERE NOT EXISTS (
  SELECT 1 FROM staging_lopest_sheets.creditos cr WHERE cr.id_credito = q.id_credito
)
ORDER BY id_cuota
LIMIT 100;

\echo '=== ENUM VALUES STAGING ==='
SELECT 'frecuencia' AS field, frecuencia AS value, COUNT(*) FROM staging_lopest_sheets.creditos GROUP BY frecuencia
UNION ALL SELECT 'estado_credito', estado_credito, COUNT(*) FROM staging_lopest_sheets.creditos GROUP BY estado_credito
UNION ALL SELECT 'tipo_amortizacion', tipo_amortizacion, COUNT(*) FROM staging_lopest_sheets.creditos GROUP BY tipo_amortizacion
UNION ALL SELECT 'estado_cuota', estado, COUNT(*) FROM staging_lopest_sheets.cuotas GROUP BY estado
UNION ALL SELECT 'tipo_pago', tipo_pago, COUNT(*) FROM staging_lopest_sheets.cuotas GROUP BY tipo_pago
ORDER BY field, value;
