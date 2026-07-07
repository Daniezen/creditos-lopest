\pset pager off
\set ON_ERROR_STOP on

\echo '=== 0. RESUMEN DE CONTEOS ==='
WITH expected_counts AS (
  SELECT 'clientes' AS entidad, COUNT(DISTINCT cedula) AS expected FROM staging_lopest_sheets.clientes WHERE NULLIF(cedula,'') IS NOT NULL
  UNION ALL SELECT 'creditos', COUNT(DISTINCT id_credito) FROM staging_lopest_sheets.creditos WHERE NULLIF(id_credito,'') IS NOT NULL
  UNION ALL SELECT 'eventos', COUNT(*) FROM staging_lopest_sheets.cuotas WHERE NULLIF(id_cuota,'') IS NOT NULL AND NULLIF(id_credito,'') IS NOT NULL
), actual_counts AS (
  SELECT 'clientes' AS entidad, COUNT(*) AS actual FROM clientes
  UNION ALL SELECT 'creditos', COUNT(*) FROM creditos
  UNION ALL SELECT 'eventos', COUNT(*) FROM eventos_financieros
)
SELECT e.entidad, e.expected, a.actual, a.actual - e.expected AS diferencia
FROM expected_counts e
JOIN actual_counts a USING (entidad)
ORDER BY e.entidad;

\echo '=== 1. DUPLICADOS DEL EXCEL / STAGING ==='
SELECT 'cliente_cedula_duplicada' AS issue, cedula AS key, COUNT(*) AS count
FROM staging_lopest_sheets.clientes
GROUP BY cedula
HAVING COUNT(*) > 1
UNION ALL
SELECT 'credito_codigo_duplicado', id_credito, COUNT(*)
FROM staging_lopest_sheets.creditos
GROUP BY id_credito
HAVING COUNT(*) > 1
UNION ALL
SELECT 'evento_codigo_duplicado', id_cuota, COUNT(*)
FROM staging_lopest_sheets.cuotas
GROUP BY id_cuota
HAVING COUNT(*) > 1
ORDER BY issue, key;

\echo '=== 2. CLIENTES FALTANTES EN DB ==='
WITH expected AS (
  SELECT DISTINCT ON (cedula) cedula
  FROM staging_lopest_sheets.clientes
  WHERE NULLIF(cedula,'') IS NOT NULL AND NULLIF(cliente,'') IS NOT NULL
  ORDER BY cedula, NULLIF(actualizado_en,'')::timestamp DESC NULLS LAST
)
SELECT e.cedula
FROM expected e
LEFT JOIN clientes c ON c.cedula = e.cedula
WHERE c.id IS NULL
ORDER BY e.cedula
LIMIT 200;

\echo '=== 3. CLIENTES EXTRA EN DB ==='
WITH expected AS (
  SELECT DISTINCT cedula
  FROM staging_lopest_sheets.clientes
  WHERE NULLIF(cedula,'') IS NOT NULL AND NULLIF(cliente,'') IS NOT NULL
)
SELECT c.cedula, c.nombre
FROM clientes c
LEFT JOIN expected e ON e.cedula = c.cedula
WHERE e.cedula IS NULL
ORDER BY c.cedula
LIMIT 200;

\echo '=== 4. DIFERENCIAS DE CAMPOS - CLIENTES ==='
WITH expected AS (
  SELECT DISTINCT ON (s.cedula)
    s.cedula,
    NULLIF(s.cliente,'') AS nombre,
    NULLIF(s.direccion,'') AS direccion,
    NULLIF(s.empresa,'') AS empresa,
    NULLIF(s.telefono,'') AS telefono,
    NULLIF(s.recomienda,'') AS recomienda,
    NULLIF(s.contacto,'') AS contacto,
    NULLIF(s.contacto_2,'') AS contacto2,
    NULLIF(s.carpeta_adjuntos,'') AS carpeta_adjuntos,
    CASE WHEN lower(s.estado_documentos) LIKE '%cargado%' THEN 'DOCUMENTOS_CARGADOS' ELSE 'FALTAN_DOCUMENTOS' END AS estado_documentos,
    COALESCE(owner_by_email.email, german.email) AS owner_email
  FROM staging_lopest_sheets.clientes s
  LEFT JOIN users owner_by_email ON lower(owner_by_email.email) = lower(s.accion_por)
    AND owner_by_email.activo = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur."roleId"
      WHERE ur."userId" = owner_by_email.id AND r.code = 'OPERADOR'
    )
  LEFT JOIN users german ON lower(german.email) = 'lopestdcm@gmail.com'
  WHERE NULLIF(s.cedula,'') IS NOT NULL AND NULLIF(s.cliente,'') IS NOT NULL
  ORDER BY s.cedula, NULLIF(s.actualizado_en,'')::timestamp DESC NULLS LAST
), actual AS (
  SELECT c.*, u.email AS owner_email
  FROM clientes c
  LEFT JOIN users u ON u.id = c."ownerUserId"
)
SELECT e.cedula, campo, expected, actual
FROM expected e
JOIN actual a ON a.cedula = e.cedula
CROSS JOIN LATERAL (VALUES
  ('nombre', e.nombre, a.nombre),
  ('direccion', e.direccion, a.direccion),
  ('empresa', e.empresa, a.empresa),
  ('telefono', e.telefono, a.telefono),
  ('recomienda', e.recomienda, a.recomienda),
  ('contacto', e.contacto, a.contacto),
  ('contacto2', e.contacto2, a.contacto2),
  ('carpetaAdjuntosUrl', e.carpeta_adjuntos, a."carpetaAdjuntosUrl"),
  ('estadoDocumentos', e.estado_documentos, a."estadoDocumentos"::text),
  ('ownerEmail', e.owner_email, a.owner_email)
) diff(campo, expected, actual)
WHERE expected IS DISTINCT FROM actual
ORDER BY e.cedula, campo
LIMIT 500;

\echo '=== 5. CREDITOS FALTANTES EN DB ==='
WITH expected AS (
  SELECT DISTINCT ON (id_credito) id_credito
  FROM staging_lopest_sheets.creditos
  WHERE NULLIF(id_credito,'') IS NOT NULL
  ORDER BY id_credito, NULLIF(actualizado_en,'')::timestamp DESC NULLS LAST
)
SELECT e.id_credito
FROM expected e
LEFT JOIN creditos c ON c.codigo = e.id_credito
WHERE c.id IS NULL
ORDER BY e.id_credito
LIMIT 200;

\echo '=== 6. CREDITOS EXTRA EN DB ==='
WITH expected AS (
  SELECT DISTINCT id_credito
  FROM staging_lopest_sheets.creditos
  WHERE NULLIF(id_credito,'') IS NOT NULL
)
SELECT c.codigo, cl.nombre
FROM creditos c
JOIN clientes cl ON cl.id = c."clienteId"
LEFT JOIN expected e ON e.id_credito = c.codigo
WHERE e.id_credito IS NULL
ORDER BY c.codigo
LIMIT 200;

\echo '=== 7. DIFERENCIAS DE CAMPOS - CREDITOS ==='
WITH expected AS (
  SELECT DISTINCT ON (s.id_credito)
    s.id_credito AS codigo,
    s.cedula,
    COALESCE(NULLIF(s.fecha_prestamo,'')::timestamp, now()) AS fecha_prestamo,
    COALESCE(NULLIF(s.monto,'')::numeric, 0) AS monto,
    COALESCE(NULLIF(s.plazo_meses,'')::numeric, 0) AS plazo_meses,
    COALESCE(NULLIF(s.tasa_mensual,'')::numeric, 0) AS tasa_mensual,
    CASE s.frecuencia
      WHEN 'Mensual' THEN 'MENSUAL'
      WHEN 'Quincenal 5/20' THEN 'QUINCENAL_5_20'
      WHEN 'Quincenal 10/25' THEN 'QUINCENAL_10_25'
      ELSE 'QUINCENAL_15_30'
    END AS frecuencia,
    CASE WHEN lower(s.tipo_amortizacion) LIKE '%solo%' THEN 'SOLO_INTERES' ELSE 'AMORTIZACION_FIJA' END AS tipo_amortizacion,
    CASE WHEN lower(s.estado_credito) LIKE '%cancel%' THEN 'CANCELADO' ELSE 'ACTIVO' END AS estado,
    NULLIF(s.observaciones,'') AS observaciones,
    NULLIF(s.nota,'') AS nota,
    NULLIF(s.fecha_cancelacion,'')::timestamp AS fecha_cancelacion,
    COALESCE(owner_by_email.email, owner_cliente.email, german.email) AS owner_email
  FROM staging_lopest_sheets.creditos s
  JOIN clientes cl ON cl.cedula = s.cedula
  LEFT JOIN users owner_cliente ON owner_cliente.id = cl."ownerUserId"
  LEFT JOIN users owner_by_email ON lower(owner_by_email.email) = lower(s.accion_por)
    AND owner_by_email.activo = true
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur."roleId"
      WHERE ur."userId" = owner_by_email.id AND r.code = 'OPERADOR'
    )
  LEFT JOIN users german ON lower(german.email) = 'lopestdcm@gmail.com'
  WHERE NULLIF(s.id_credito,'') IS NOT NULL
  ORDER BY s.id_credito, NULLIF(s.actualizado_en,'')::timestamp DESC NULLS LAST
), actual AS (
  SELECT cr.*, cl.cedula, u.email AS owner_email
  FROM creditos cr
  JOIN clientes cl ON cl.id = cr."clienteId"
  LEFT JOIN users u ON u.id = cr."ownerUserId"
)
SELECT e.codigo, campo, expected, actual
FROM expected e
JOIN actual a ON a.codigo = e.codigo
CROSS JOIN LATERAL (VALUES
  ('cedula_cliente', e.cedula, a.cedula),
  ('fechaPrestamo', e.fecha_prestamo::text, a."fechaPrestamo"::text),
  ('monto', e.monto::text, a.monto::text),
  ('plazoMeses', e.plazo_meses::text, a."plazoMeses"::text),
  ('tasaMensual', e.tasa_mensual::text, a."tasaMensual"::text),
  ('frecuencia', e.frecuencia, a.frecuencia::text),
  ('tipoAmortizacion', e.tipo_amortizacion, a."tipoAmortizacion"::text),
  ('estado', e.estado, a.estado::text),
  ('observaciones', e.observaciones, a.observaciones),
  ('nota', e.nota, a.nota),
  ('fechaCancelacion', e.fecha_cancelacion::text, a."fechaCancelacion"::text),
  ('ownerEmail', e.owner_email, a.owner_email)
) diff(campo, expected, actual)
WHERE expected IS DISTINCT FROM actual
ORDER BY e.codigo, campo
LIMIT 500;

\echo '=== 8. EVENTOS FALTANTES EN DB ==='
WITH expected AS (
  SELECT CASE WHEN rn = 1 THEN id_cuota ELSE id_cuota || '-DUP' || rn::text END AS codigo
  FROM (
    SELECT q.*, row_number() OVER (
      PARTITION BY q.id_cuota
      ORDER BY NULLIF(q.actualizado_en,'')::timestamp DESC NULLS LAST,
               NULLIF(q.creado_en,'')::timestamp DESC NULLS LAST,
               q.id_credito,
               q.n_cuota
    ) AS rn
    FROM staging_lopest_sheets.cuotas q
    WHERE NULLIF(q.id_cuota,'') IS NOT NULL AND NULLIF(q.id_credito,'') IS NOT NULL
  ) x
)
SELECT e.codigo
FROM expected e
LEFT JOIN eventos_financieros a ON a.codigo = e.codigo
WHERE a.id IS NULL
ORDER BY e.codigo
LIMIT 200;

\echo '=== 9. EVENTOS EXTRA EN DB ==='
WITH expected AS (
  SELECT CASE WHEN rn = 1 THEN id_cuota ELSE id_cuota || '-DUP' || rn::text END AS codigo
  FROM (
    SELECT q.*, row_number() OVER (
      PARTITION BY q.id_cuota
      ORDER BY NULLIF(q.actualizado_en,'')::timestamp DESC NULLS LAST,
               NULLIF(q.creado_en,'')::timestamp DESC NULLS LAST,
               q.id_credito,
               q.n_cuota
    ) AS rn
    FROM staging_lopest_sheets.cuotas q
    WHERE NULLIF(q.id_cuota,'') IS NOT NULL AND NULLIF(q.id_credito,'') IS NOT NULL
  ) x
)
SELECT a.codigo, cr.codigo AS credito
FROM eventos_financieros a
JOIN creditos cr ON cr.id = a."creditoId"
LEFT JOIN expected e ON e.codigo = a.codigo
WHERE e.codigo IS NULL
ORDER BY a.codigo
LIMIT 200;

\echo '=== 10. DIFERENCIAS DE CAMPOS - EVENTOS ==='
WITH expected AS (
  SELECT
    CASE WHEN rn = 1 THEN q.id_cuota ELSE q.id_cuota || '-DUP' || rn::text END AS codigo,
    q.id_credito,
    NULLIF(q.n_cuota,'')::integer AS numero_cuota,
    CASE WHEN q.tipo_pago = 'ABONO_CAPITAL' THEN 'ABONO_CAPITAL' ELSE 'CUOTA_PROGRAMADA' END AS tipo,
    COALESCE(NULLIF(q.fecha_programada,'')::timestamp, now()) AS fecha_programada,
    NULLIF(q.fecha_pago,'')::timestamp AS fecha_pago,
    COALESCE(NULLIF(q.valor_cuota,'')::numeric, 0) AS valor_programado,
    COALESCE(NULLIF(q.capital_programado,'')::numeric, 0) AS capital_programado,
    COALESCE(NULLIF(q.interes_programado,'')::numeric, 0) AS interes_programado,
    COALESCE(NULLIF(q.monto_pagado,'')::numeric, 0) AS monto_pagado,
    COALESCE(NULLIF(q.capital_pagado,'')::numeric, 0) AS capital_pagado,
    COALESCE(NULLIF(q.interes_pagado,'')::numeric, 0) AS interes_pagado,
    NULLIF(q.saldo_capital_post,'')::numeric AS saldo_capital_post,
    CASE
      WHEN lower(q.estado) = 'pagado' THEN 'PAGADO'
      WHEN lower(q.estado) LIKE '%cancelado%' THEN 'CANCELADO_POR_ABONO'
      WHEN lower(q.estado) LIKE '%mora%' THEN 'MORA'
      WHEN lower(q.estado) LIKE '%atras%' THEN 'ATRASADO'
      ELSE 'PENDIENTE'
    END AS estado,
    COALESCE(NULLIF(q.dias_atraso,'')::integer, 0) AS dias_atraso
  FROM (
    SELECT q.*, row_number() OVER (
      PARTITION BY q.id_cuota
      ORDER BY NULLIF(q.actualizado_en,'')::timestamp DESC NULLS LAST,
               NULLIF(q.creado_en,'')::timestamp DESC NULLS LAST,
               q.id_credito,
               q.n_cuota
    ) AS rn
    FROM staging_lopest_sheets.cuotas q
    WHERE NULLIF(q.id_cuota,'') IS NOT NULL AND NULLIF(q.id_credito,'') IS NOT NULL
  ) q
), actual AS (
  SELECT e.*, cr.codigo AS id_credito
  FROM eventos_financieros e
  JOIN creditos cr ON cr.id = e."creditoId"
)
SELECT e.codigo, campo, expected, actual
FROM expected e
JOIN actual a ON a.codigo = e.codigo
CROSS JOIN LATERAL (VALUES
  ('id_credito', e.id_credito, a.id_credito),
  ('numeroCuota', e.numero_cuota::text, a."numeroCuota"::text),
  ('tipo', e.tipo, a.tipo::text),
  ('fechaProgramada', e.fecha_programada::text, a."fechaProgramada"::text),
  ('fechaPago', e.fecha_pago::text, a."fechaPago"::text),
  ('valorProgramado', e.valor_programado::text, a."valorProgramado"::text),
  ('capitalProgramado', e.capital_programado::text, a."capitalProgramado"::text),
  ('interesProgramado', e.interes_programado::text, a."interesProgramado"::text),
  ('montoPagado', e.monto_pagado::text, a."montoPagado"::text),
  ('capitalPagado', e.capital_pagado::text, a."capitalPagado"::text),
  ('interesPagado', e.interes_pagado::text, a."interesPagado"::text),
  ('saldoCapitalPost', e.saldo_capital_post::text, a."saldoCapitalPost"::text),
  ('estado', e.estado, a.estado::text),
  ('diasAtraso', e.dias_atraso::text, a."diasAtraso"::text)
) diff(campo, expected, actual)
WHERE expected IS DISTINCT FROM actual
ORDER BY e.codigo, campo
LIMIT 1000;

\echo '=== 11. CHECK FINAL: TOTAL DE DIFERENCIAS ==='
WITH
clientes_expected AS (
  SELECT COUNT(*) AS n FROM (
    SELECT DISTINCT ON (cedula) cedula FROM staging_lopest_sheets.clientes
    WHERE NULLIF(cedula,'') IS NOT NULL AND NULLIF(cliente,'') IS NOT NULL
    ORDER BY cedula, NULLIF(actualizado_en,'')::timestamp DESC NULLS LAST
  ) x
), creditos_expected AS (
  SELECT COUNT(*) AS n FROM (
    SELECT DISTINCT ON (id_credito) id_credito FROM staging_lopest_sheets.creditos
    WHERE NULLIF(id_credito,'') IS NOT NULL
    ORDER BY id_credito, NULLIF(actualizado_en,'')::timestamp DESC NULLS LAST
  ) x
), eventos_expected AS (
  SELECT COUNT(*) AS n FROM staging_lopest_sheets.cuotas
  WHERE NULLIF(id_cuota,'') IS NOT NULL AND NULLIF(id_credito,'') IS NOT NULL
)
SELECT 'clientes_count_ok' AS check_name, (SELECT n FROM clientes_expected) = (SELECT COUNT(*) FROM clientes) AS ok
UNION ALL SELECT 'creditos_count_ok', (SELECT n FROM creditos_expected) = (SELECT COUNT(*) FROM creditos)
UNION ALL SELECT 'eventos_count_ok', (SELECT n FROM eventos_expected) = (SELECT COUNT(*) FROM eventos_financieros);
