# Especificación funcional — Créditos, Amortizaciones y Exportación

```
ESTADO:    Implementado y probado
CORTE:     30-ago-2026
EVIDENCIA: web/src/features/creditos/__tests__/ (pruebas de cuotas, balances, facetas y exportación pasando)
```

## 1. Propósito y alcance

Gobierna el ciclo de vida completo de un crédito financiero: creación idempotente, generación del plan de cuotas, modalidades de amortización, cálculo de atraso/mora, balance de saldo deudor, soft-delete y exportación de cartera a Excel.

## 2. Modelos de dominio (`Credito` y `EventoFinanciero`)

### Crédito
- `codigo`: Identificador de negocio único generado secuencialmente por año (`SecuenciaCredito`).
- `idempotencyKey`: Clave única para evitar duplicados en la creación desde el formulario.
- `clienteId`: Enlace obligatorio a `Cliente`.
- `ownerUserId`: Propietario operativo/financiero del crédito.
- `monto`, `plazoMeses`, `tasaMensual`: Parámetros financieros en base decimal fija.
- `frecuencia`: `MENSUAL`, `QUINCENAL_5_20`, `QUINCENAL_10_25`, `QUINCENAL_15_30`.
- `tipoAmortizacion`:
  - `AMORTIZACION_FIJA`: Capital dividido uniformemente entre el número de cuotas más intereses sobre saldo deudor.
  - `SOLO_INTERES`: Intereses mensuales/quincenales fijos, con pago total del capital en la última cuota.
- `estado`: `ACTIVO` | `CANCELADO`.
- `eliminadoEn`, `eliminadoPor`, `motivoEliminacion`: Soft-delete trazable.

### Evento Financiero (Cuota / Abono)
- `numeroCuota`: Índice correlativo para cuotas programadas.
- `tipo`: `CUOTA_PROGRAMADA` | `ABONO_CAPITAL`.
- `fechaProgramada`, `fechaPago`.
- `valorProgramado`, `capitalProgramado`, `interesProgramado`.
- `montoPagado`, `capitalPagado`, `interesPagado`, `saldoCapitalPost`.
- `estado`: `PENDIENTE`, `ATRASADO`, `MORA`, `PAGADO`, `CANCELADO_POR_ABONO`.
- `diasAtraso`: Contador calculado frente a la fecha actual de corte.

## 3. Creación de Créditos (`/creditos/nuevo`)

- **Proceso en 3 Pasos (Stepper):**
  1. *Selección de Cliente:* Autocomplete con búsqueda por nombre/cédula o creación rápida modal sin abandonar el flujo.
  2. *Condiciones Financieras:* Monto, plazo, tasa, frecuencia, fecha de desembolso y modalidad de amortización.
  3. *Confirmación y Tabla:* Vista previa en tiempo real de todas las cuotas calculadas antes de persistir.
- **Idempotencia:** La Server Action utiliza transacciones serializables de Prisma y verifica `idempotencyKey` para prevenir dobles desembolsos por reintentos o clics repetidos.

## 4. Eliminación de Créditos (Soft-Delete)

- Los créditos nunca se borran físicamente (`DELETE`) para salvaguardar la integridad de los balances históricos.
- La eliminación establece `eliminadoEn = now()`, `eliminadoPor = session.user.id` y exige un `motivoEliminacion`.
- Las consultas ordinarias excluyen automáticamente los registros con `eliminadoEn != null`.

## 5. Exportación a Excel (`/api/creditos/exportar-resultados`)

- Route handler en Next.js que genera libros `.xlsx` estructurados con `exceljs`.
- Soporta filtros facetados combinados: estado de cartera, propietario, rangos de mora, cliente y búsqueda de texto.
- Aplica formato financiero (monedas, fechas formateadas, colores de estado y totales acumulados).

## 6. Verificación contra código

| Afirmación | Archivo de referencia | Estado |
|---|---|---|
| Cálculo de balance actual de capital | `web/src/features/creditos/current-capital-balance.ts` | Test unitario pasando |
| Política de soft-delete trazable | `web/src/features/creditos/deletion-policy.ts` | Test unitario pasando |
| Parámetros y filtros facetados de créditos | `web/src/features/creditos/credit-filter-params.ts` | Test unitario pasando |
| Exportación de resultados a Excel | `web/src/features/creditos/credit-export.ts` | Test unitario pasando |
| Políticas de cuotas vencidas y atrasos | `web/src/features/creditos/pagos/overdue-policy.ts` | Test unitario pasando |

---

**Changelog:** 30-ago-2026 — Especificación de créditos, amortizaciones, soft-delete y exportación a Excel.
