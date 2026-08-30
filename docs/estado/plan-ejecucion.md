# Plan de Ejecución — Plataforma Créditos Lopest

```
ESTADO:    Cola de trabajo vigente
CORTE:     30-ago-2026
```

Define la cola ordenada de unidades de trabajo para el desarrollo y evolución de Lopest. Cada unidad especifica su objetivo, alcance, evidencia requerida y condición de cierre verificable.

## Cola de Unidades de Trabajo

### U1 · Consolidación y visualización del módulo de Reportes y Analytics — **CABEZA DE COLA**

**Objetivo:** Implementar los tableros analíticos en `/reportes` y `/analytics` con agregaciones sobre el estado de la cartera, flujo proyectado de cobranzas y tasas efectivas de morosidad.

**Escenarios mínimos:**
- Agregación por rangos de fechas de desembolso y vencimiento.
- Gráficos de distribución de capital prestado vs capital recuperado.
- Segmentación por propietario de cartera (`ownerUserId`).
- Exportación agregada en formato Excel / CSV.

**Evidencia requerida:** Pruebas unitarias de cálculo de métricas financieras agregadas y build estático verde.

### U2 · Alertas y Recordatorios de Vencimiento de Cuotas

**Objetivo:** Desarrollar mecanismos de notificación para cobradores / administradores ante cuotas que entran en estado `ATRASADO` o `MORA`.

**Escenarios:**
- Detección automática en el cron de cuotas vencidas (`/api/cron/creditos/vencidas`).
- Resumen consolidado para el propietario financiero del crédito.
- Registro en `AuditLog` del envío de recordatorios.

### U3 · Refinamiento del Simulador de Créditos e Impresión de Cotizaciones

**Objetivo:** Permitir la exportación o impresión en PDF de la cotización generada en `/simulador`, respetando la identidad y geometría del contrato de diseño Lopest.

**Escenarios:**
- Generación de documento imprimible con tabla de amortización completa.
- Resumen de condiciones financieras y desglose de cuotas.

### U4 · Monitoreo y Reconciliación Automatizada con Google Drive

**Objetivo:** Optimizar el cron job de reconciliación documental con métricas de archivos activos vs inaccesibles en Drive, emitiendo alertas cuando un documento crítico pierda disponibilidad.

---

## Método por Unidad

Toda unidad se rige por el protocolo de cambio seguro (`ciclo-de-trabajo`):
1. **Inspección** de contexto y anclajes con herramientas dirigidas (`recolectar_*.py` si la unidad es compleja).
2. **Definición** de invariantes y contratos.
3. **Aplicación** atómica con herramientas directas o scripts de python validados.
4. **Validación** mediante `pnpm validate` y `pnpm test`.
5. **Cierre** y actualización del handoff técnico.

---

**Changelog:** 30-ago-2026 — Plan de ejecución actualizado y enfocado en la evolución de Créditos Lopest.
