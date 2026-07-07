DROP SCHEMA IF EXISTS staging_lopest_sheets CASCADE;
CREATE SCHEMA staging_lopest_sheets;

CREATE TABLE staging_lopest_sheets.clientes (
  cedula text,
  cliente text,
  direccion text,
  empresa text,
  telefono text,
  recomienda text,
  contacto text,
  contacto_2 text,
  creado_en text,
  actualizado_en text,
  accion_por text,
  carpeta_adjuntos text,
  estado_documentos text
);

CREATE TABLE staging_lopest_sheets.creditos (
  id_credito text,
  cliente text,
  cedula text,
  fecha_prestamo text,
  monto text,
  plazo_meses text,
  tasa_mensual text,
  frecuencia text,
  observaciones text,
  nota text,
  estado_credito text,
  fecha_cancelacion text,
  creado_en text,
  actualizado_en text,
  accion_por text,
  tipo_amortizacion text
);

CREATE TABLE staging_lopest_sheets.cuotas (
  id_cuota text,
  id_credito text,
  cliente text,
  n_cuota text,
  fecha_programada text,
  valor_cuota text,
  capital_programado text,
  interes_programado text,
  monto_pagado text,
  capital_pagado text,
  interes_pagado text,
  saldo_capital_post text,
  estado text,
  dias_atraso text,
  fecha_pago text,
  creado_en text,
  actualizado_en text,
  accion_por text,
  tipo_pago text
);
