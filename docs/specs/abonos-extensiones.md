# Especificación funcional — Abonos a Capital, Extensiones de Plazo y Snapshots Reversibles

```
ESTADO:    Implementado y probado
CORTE:     30-ago-2026
EVIDENCIA: web/src/features/creditos/abonos/__tests__/ y web/src/features/creditos/plazos/__tests__/ (pruebas de políticas y reversión pasando)
```

## 1. Propósito y alcance

Establece las reglas para la alteración estructural del plan de pagos de un crédito en Lopest mediante:
1. **Abonos a Capital Extraordinarios:** Reducción del saldo deudor y recálculo del valor o número de cuotas restantes.
2. **Extensiones de Plazo:** Ampliación del número de cuotas y reprogramación del calendario financiero.
3. **Reversibilidad Garantizada:** Capacidad de auditoría y reversión exacta a través de instantáneas JSON inmutables.

## 2. Abonos a Capital (`AbonoSnapshot`)

- Cuando un cliente realiza un abono a capital:
  1. Se especifica el monto del abono y la fecha efectiva de pago (`fechaAbono`), la cual se valida para no ser anterior a la fecha del préstamo ni posterior a la fecha actual de corte (por defecto hoy en zona horaria Colombia).
  2. Se crea un `EventoFinanciero` de tipo `ABONO_CAPITAL` con el monto pagado y la fecha configurada (`fechaProgramada` y `fechaPago`).
  3. Se recalculan las cuotas futuras pendientes (disminuyendo el capital o el número de cuotas según la política de amortización).
  4. Se genera un `AbonoSnapshot` que almacena:
     - `creditoAntes`: Estado del crédito antes del abono.
     - `eventosAntes`: Lista completa de cuotas y estados previos.
     - `eventosDespues`: Lista resultante tras el recálculo.
     - `aplicadoEn`, `creadoPor`: Trazabilidad de auditoría.
- **Edición de Fecha de Abono:** En el detalle de movimientos del crédito, la fecha real de pago de un abono extraordinario puede ser editada inline (respetando los mismos límites de fecha del préstamo y no futuro), registrando el evento de auditoría `ABONO_UPDATE_PAYMENT_DATE`.
- **Reversión de Abonos:** Al revertir un abono, se restauran atómicamente las cuotas desde `eventosAntes` y se cancela el evento de abono.

## 3. Extensiones de Plazo (`ExtensionPlazoSnapshot`)

- Permite diferir o añadir cuotas al plan de pagos cuando un cliente solicita refinanciación o prórroga.
- Al aplicar la extensión:
  1. Se actualiza el plazo del crédito (`plazoMeses`).
  2. Se generan nuevas cuotas programadas en base a la tasa y saldo deudor.
  3. Se crea el snapshot `ExtensionPlazoSnapshot` con:
     - `creditoAntes`, `creditoDespues`
     - `eventosAntes`, `eventosDespues`, `eventosCreados`
     - `revertidoEn`, `revertidoPor`, `motivoReversion`
- **Reversión de Extensión:** Elimina las cuotas generadas (`eventosCreados`), restablece las cuotas modificadas a su estado original (`eventosAntes`) y marca el snapshot como revertido con justificación obligatoria.

## 4. Invariantes de Reversibilidad

- **Integridad Transaccional:** Tanto la aplicación como la reversión se ejecutan dentro de una transacción `prisma.$transaction` interactiva.
- **Idempotencia:** No es posible revertir dos veces el mismo snapshot ni aplicar una reversión sobre un snapshot que tenga dependencias financieras posteriores sin resolverlas en orden LIFO.

## 5. Verificación contra código

| Afirmación | Archivo de referencia | Estado |
|---|---|---|
| Política de recálculo y reversión de abonos | `web/src/features/creditos/abonos/recalculated-reversal-policy.ts` | Tests pasando |
| Snapshot inmutable de abonos | `web/src/features/creditos/abonos/snapshot.ts` | Verificado con tipos |
| Política y recálculo de extensión de plazo | `web/src/features/creditos/plazos/extension-policy.ts` | Tests pasando |
| Acciones de servidor de extensiones | `web/src/features/creditos/plazos/actions.ts` | Verificado con build |

---

**Changelog:** 30-ago-2026 — Especificación de abonos a capital, extensiones de plazo y snapshots reversibles.
