BEGIN;

TRUNCATE TABLE documentos_cliente, eventos_financieros, creditos, clientes, secuencias_credito CASCADE;

WITH clientes_dedup AS (
  SELECT DISTINCT ON (cedula)
    cedula, cliente, direccion, empresa, telefono, recomienda, contacto, contacto_2,
    creado_en, actualizado_en, accion_por, carpeta_adjuntos, estado_documentos
  FROM staging_lopest_sheets.clientes
  WHERE NULLIF(cedula, '') IS NOT NULL
    AND NULLIF(cliente, '') IS NOT NULL
  ORDER BY cedula, NULLIF(actualizado_en, '')::timestamp DESC NULLS LAST
)
INSERT INTO clientes (
  id, cedula, nombre, direccion, empresa, telefono, recomienda, contacto, contacto2,
  "carpetaAdjuntosUrl", "estadoDocumentos", "creadoEn", "actualizadoEn", "accionPor", "ownerUserId"
)
SELECT
  'cl_' || substr(md5(c.cedula), 1, 24),
  c.cedula,
  NULLIF(c.cliente, ''),
  NULLIF(c.direccion, ''),
  NULLIF(c.empresa, ''),
  NULLIF(c.telefono, ''),
  NULLIF(c.recomienda, ''),
  NULLIF(c.contacto, ''),
  NULLIF(c.contacto_2, ''),
  NULLIF(c.carpeta_adjuntos, ''),
  CASE WHEN lower(c.estado_documentos) LIKE '%cargado%' THEN 'DOCUMENTOS_CARGADOS'::"EstadoDocumentos" ELSE 'FALTAN_DOCUMENTOS'::"EstadoDocumentos" END,
  COALESCE(NULLIF(c.creado_en, '')::timestamp, now()),
  COALESCE(NULLIF(c.actualizado_en, '')::timestamp, now()),
  NULLIF(c.accion_por, ''),
  COALESCE(owner_by_email.id, german.id)
FROM clientes_dedup c
LEFT JOIN users owner_by_email ON lower(owner_by_email.email) = lower(c.accion_por)
  AND owner_by_email.activo = true
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur."roleId"
    WHERE ur."userId" = owner_by_email.id AND r.code = 'OPERADOR'
  )
LEFT JOIN users german ON lower(german.email) = 'lopestdcm@gmail.com';

WITH creditos_dedup AS (
  SELECT DISTINCT ON (id_credito)
    *
  FROM staging_lopest_sheets.creditos
  WHERE NULLIF(id_credito, '') IS NOT NULL
    AND NULLIF(cedula, '') IS NOT NULL
  ORDER BY id_credito, NULLIF(actualizado_en, '')::timestamp DESC NULLS LAST
)
INSERT INTO creditos (
  id, codigo, "clienteId", "fechaPrestamo", monto, "plazoMeses", "tasaMensual",
  frecuencia, "tipoAmortizacion", estado, observaciones, nota, "fechaCancelacion",
  "creadoEn", "actualizadoEn", "accionPor", "ownerUserId"
)
SELECT
  'cr_' || substr(md5(c.id_credito), 1, 24),
  c.id_credito,
  cl.id,
  COALESCE(NULLIF(c.fecha_prestamo, '')::timestamp, now()),
  COALESCE(NULLIF(c.monto, '')::numeric, 0),
  COALESCE(NULLIF(c.plazo_meses, '')::numeric, 0),
  COALESCE(NULLIF(c.tasa_mensual, '')::numeric, 0),
  CASE c.frecuencia
    WHEN 'Mensual' THEN 'MENSUAL'::"FrecuenciaPago"
    WHEN 'Quincenal 5/20' THEN 'QUINCENAL_5_20'::"FrecuenciaPago"
    WHEN 'Quincenal 10/25' THEN 'QUINCENAL_10_25'::"FrecuenciaPago"
    ELSE 'QUINCENAL_15_30'::"FrecuenciaPago"
  END,
  CASE WHEN lower(c.tipo_amortizacion) LIKE '%solo%' THEN 'SOLO_INTERES'::"TipoAmortizacion" ELSE 'AMORTIZACION_FIJA'::"TipoAmortizacion" END,
  CASE WHEN lower(c.estado_credito) LIKE '%cancel%' THEN 'CANCELADO'::"EstadoCredito" ELSE 'ACTIVO'::"EstadoCredito" END,
  NULLIF(c.observaciones, ''),
  NULLIF(c.nota, ''),
  NULLIF(c.fecha_cancelacion, '')::timestamp,
  COALESCE(NULLIF(c.creado_en, '')::timestamp, now()),
  COALESCE(NULLIF(c.actualizado_en, '')::timestamp, now()),
  NULLIF(c.accion_por, ''),
  COALESCE(owner_by_email.id, cl."ownerUserId", german.id)
FROM creditos_dedup c
JOIN clientes cl ON cl.cedula = c.cedula
LEFT JOIN users owner_by_email ON lower(owner_by_email.email) = lower(c.accion_por)
  AND owner_by_email.activo = true
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur."roleId"
    WHERE ur."userId" = owner_by_email.id AND r.code = 'OPERADOR'
  )
LEFT JOIN users german ON lower(german.email) = 'lopestdcm@gmail.com';

WITH cuotas_numbered AS (
  SELECT
    q.*,
    row_number() OVER (
      PARTITION BY q.id_cuota
      ORDER BY NULLIF(q.actualizado_en, '')::timestamp DESC NULLS LAST,
               NULLIF(q.creado_en, '')::timestamp DESC NULLS LAST,
               q.id_credito,
               q.n_cuota
    ) AS rn
  FROM staging_lopest_sheets.cuotas q
  WHERE NULLIF(q.id_cuota, '') IS NOT NULL
    AND NULLIF(q.id_credito, '') IS NOT NULL
)
INSERT INTO eventos_financieros (
  id, codigo, "creditoId", "numeroCuota", tipo, "fechaProgramada", "fechaPago",
  "valorProgramado", "capitalProgramado", "interesProgramado",
  "montoPagado", "capitalPagado", "interesPagado", "saldoCapitalPost",
  estado, "diasAtraso", "creadoEn", "actualizadoEn", "accionPor"
)
SELECT
  'ev_' || substr(md5(q.id_cuota || '#' || q.rn::text), 1, 24),
  CASE WHEN q.rn = 1 THEN q.id_cuota ELSE q.id_cuota || '-DUP' || q.rn::text END,
  cr.id,
  NULLIF(q.n_cuota, '')::integer,
  CASE WHEN q.tipo_pago = 'ABONO_CAPITAL' THEN 'ABONO_CAPITAL'::"TipoEventoFinanciero" ELSE 'CUOTA_PROGRAMADA'::"TipoEventoFinanciero" END,
  COALESCE(NULLIF(q.fecha_programada, '')::timestamp, now()),
  NULLIF(q.fecha_pago, '')::timestamp,
  COALESCE(NULLIF(q.valor_cuota, '')::numeric, 0),
  COALESCE(NULLIF(q.capital_programado, '')::numeric, 0),
  COALESCE(NULLIF(q.interes_programado, '')::numeric, 0),
  COALESCE(NULLIF(q.monto_pagado, '')::numeric, 0),
  COALESCE(NULLIF(q.capital_pagado, '')::numeric, 0),
  COALESCE(NULLIF(q.interes_pagado, '')::numeric, 0),
  NULLIF(q.saldo_capital_post, '')::numeric,
  CASE
    WHEN lower(q.estado) = 'pagado' THEN 'PAGADO'::"EstadoEventoFinanciero"
    WHEN lower(q.estado) LIKE '%cancelado%' THEN 'CANCELADO_POR_ABONO'::"EstadoEventoFinanciero"
    WHEN lower(q.estado) LIKE '%mora%' THEN 'MORA'::"EstadoEventoFinanciero"
    WHEN lower(q.estado) LIKE '%atras%' THEN 'ATRASADO'::"EstadoEventoFinanciero"
    ELSE 'PENDIENTE'::"EstadoEventoFinanciero"
  END,
  COALESCE(NULLIF(q.dias_atraso, '')::integer, 0),
  COALESCE(NULLIF(q.creado_en, '')::timestamp, now()),
  COALESCE(NULLIF(q.actualizado_en, '')::timestamp, now()),
  NULLIF(q.accion_por, '')
FROM cuotas_numbered q
JOIN creditos cr ON cr.codigo = q.id_credito;

INSERT INTO secuencias_credito (id, anio, "ultimoNumero", "creadoEn", "actualizadoEn")
SELECT
  'seq_' || (2000 + substring(codigo from '^LP-([0-9]{2})-')::int)::text,
  2000 + substring(codigo from '^LP-([0-9]{2})-')::int,
  max(substring(codigo from '^LP-[0-9]{2}-([0-9]+)$')::int),
  now(),
  now()
FROM creditos
WHERE codigo ~ '^LP-[0-9]{2}-[0-9]+$'
GROUP BY 2000 + substring(codigo from '^LP-([0-9]{2})-')::int;

COMMIT;

SELECT 'clientes_db' AS metric, COUNT(*) FROM clientes
UNION ALL SELECT 'creditos_db', COUNT(*) FROM creditos
UNION ALL SELECT 'eventos_db', COUNT(*) FROM eventos_financieros
UNION ALL SELECT 'secuencias_credito_db', COUNT(*) FROM secuencias_credito;
