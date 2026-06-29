# Reglas de negocio heredadas desde Google Sheets / Apps Script

## 1. Cronograma

### Modalidades

El motor heredado soporta:

- Amortización Fija.
- Solo Interés.

### Frecuencias

El motor heredado soporta:

- Mensual.
- Quincenal 15/30.
- Quincenal 5/20.
- Quincenal 10/25.

### Regla de salto de primera cuota

Si entre la fecha del préstamo y la primera fecha de corte hay <= 6 días inclusivos, la primera cuota se salta al siguiente periodo.

### Amortización fija mensual

- Interés mensual = capital inicial * tasa mensual.
- Capital programado mensual = capital inicial / plazo meses.
- La última cuota ajusta el capital restante para evitar residuos decimales.
- Valor cuota = capital programado + interés programado.

### Amortización fija quincenal

- Número de cuotas = plazo meses * 2.
- Interés quincenal = interés mensual / 2.
- Capital quincenal = capital mensual / 2.
- La última cuota ajusta el capital restante.

### Solo interés

- El capital permanece congelado hasta la última cuota.
- Cada cuota paga interés.
- La última cuota paga interés + capital.
- Si es quincenal, la tasa aplicada por evento es tasa mensual / 2.

## 2. Estados de cuotas

Estados heredados observados:

- Pendiente.
- Atrasado.
- Mora.
- Pagado.
- Cancelado por Abono.

Regla implementada en Sheets:

- Si una cuota está Pendiente y fecha_programada < hoy, pasa a Atrasado.
- No se observó una regla formal completa de transición Atrasado -> Mora en el código compartido.

## 3. Pago de cuota

En Sheets, el checkbox "¿Pagado?" ejecuta:

### Marcar pagado

- estado = Pagado.
- fecha_pago = hoy.
- monto_pagado = valor_cuota.

### Desmarcar pagado

- monto_pagado = 0.
- fecha_pago = vacío.
- estado = Atrasado si fecha_programada < hoy.
- estado = Pendiente si fecha_programada >= hoy.

## 4. Columnas visibles de cuotas en la hoja

La vista heredada muestra:

- Número de Cuota.
- Fecha Programada.
- Fecha Real de Pago.
- Valor Cuota.
- Parte de la cuota que se convierte en abono a intereses.
- Saldo crédito capital después del pago.
- Estado.
- ¿Pagado?

En el sistema web, la columna "Parte de la cuota que se convierte en abono a intereses" debe mapearse técnicamente a interesProgramado / interesPagado según estado.

## 5. Abono extraordinario a capital

### Evento histórico

Sheets crea una fila en Cuotas con:

- tipo_pago = ABONO_CAPITAL.
- fecha_programada = hoy.
- fecha_pago = hoy.
- valor_cuota = valorAbono.
- capital_programado = valorAbono.
- monto_pagado = valorAbono.
- capital_pagado = valorAbono.
- estado = Pagado.

### Amortización fija

El abono reduce plazo atacando cuotas pendientes desde la cola del cronograma:

1. Se ordenan cuotas pendientes/atrasadas desde la última hacia atrás.
2. Si el abono cubre todo el capital_programado de una cuota:
   - capital_programado = 0.
   - interes_programado = 0.
   - valor_cuota = 0.
   - estado = Cancelado por Abono.
3. Si cubre parcialmente:
   - capital_programado = capital_programado - abonoRestante.
   - valor_cuota = nuevoCapital + interes_programado.

### Solo interés

El abono reduce la base de capital:

1. Se calcula nuevo saldo de capital.
2. Se recalcula interés futuro = nuevoSaldoCapital * tasaPeriodo.
3. La cuota final conserva el capital restante.
4. Si el saldo queda en 0, las cuotas futuras pasan a Cancelado por Abono.

## 6. Prórroga de Solo Interés

La prórroga:

- aplica solo a créditos de Solo Interés;
- quita el capital de la cuota final actual;
- agrega nuevas cuotas futuras;
- mueve el capital al final del nuevo plazo extendido.

## 7. Principio de migración

No copiar Apps Script literalmente.

El sistema web debe implementar estas reglas mediante:

- server actions transaccionales;
- Prisma/PostgreSQL;
- revalidación de vistas;
- trazabilidad de usuario;
- bloqueo de mutaciones destructivas después de actividad financiera.
