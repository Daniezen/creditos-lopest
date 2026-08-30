# Contexto canónico de Créditos Lopest

```
ÁMBITO:  decisiones de producto, reglas de negocio y fronteras arquitectónicas ESTABLES
CORTE:   30-ago-2026
EXCLUYE: estado de implementación, evidencia, rutas, commits, próxima acción → handoff
         detalle funcional → especificación vigente de cada dominio
```

## Autoridad y taxonomía

La precedencia de fuentes y el mapa completo de propiedad documental se definen centralizadamente en [`docs/README-documentacion.md`](file:///home/deploy/apps/lopest/docs/README-documentacion.md). Este documento actúa como autoridad exclusiva para las decisiones estables de producto, reglas de negocio y fronteras arquitectónicas de Lopest.

---

## 1. Definición del producto

Lopest es la plataforma integral de gestión financiera de créditos, cartera de clientes, planes de pago, amortizaciones, cobranza y reconciliación documental.

- La aplicación web reside en el subdirectorio `web/` (Next.js 16 App Router con Turbopack, React 19, TypeScript 5, Tailwind CSS 4, Prisma 7).
- PostgreSQL 18 es la **fuente durable y transaccional de verdad** para clientes, créditos, cuotas, snapshots de auditoría y cuentas.
- Google Drive actúa como repositorio documental externo sincronizado periódicamente, sin destruir registros ante desvinculaciones.
- Los cálculos financieros deben ser matemáticamente deterministas, auditables e idempotentes.

## 2. Roles, autorización y gobierno de cartera

La autorización se ejecuta en servidor mediante la verificación de sesión, roles técnicos y alcance de propiedad (`ownerUserId`):

| Rol / Concepto | Regla estable |
|---|---|
| `Role.code` | Identificador técnico evaluado en backend para autorizar operaciones (`ADMIN`, `OPERADOR`, etc.). |
| `Role.name` | Cadena legible destinada exclusivamente a la interfaz de usuario. Nunca se usa para evaluar permisos. |
| `Cliente.ownerUserId` | Propietario principal / documental del cliente. |
| `Credito.ownerUserId` | Propietario financiero / operativo del crédito individual. Permite que clientes compartidos tengan créditos con distintos dueños de cartera. |
| Transferencias | La cartera puede transferirse entre usuarios registrando auditoría completa del emisor, receptor y fecha. |

## 3. Clientes y gestión documental

- Todo cliente cuenta con cédula única, datos de contacto, empresa, recomendador (`recomienda`) y estado documental (`FALTAN_DOCUMENTOS` vs `DOCUMENTOS_CARGADOS`).
- Los documentos adjuntos se almacenan en Google Drive bajo carpetas dedicadas por cliente.
- **Reconciliación no destructiva:** Si un archivo es eliminado o movido en Google Drive, el registro `DocumentoCliente` en PostgreSQL se marca con `driveDisponible = false` y se registra la fecha de verificación, preservando la trazabilidad financiera histórica.

## 4. Créditos, amortizaciones y cuotas

- Los créditos soportan modalidades de amortización:
  - `AMORTIZACION_FIJA`: Capital distribuido uniformemente entre cuotas más interés sobre saldo deudor.
  - `SOLO_INTERES`: Pago de intereses periódicos y amortización total de capital en la última cuota.
- Frecuencias de pago configurables: `MENSUAL`, `QUINCENAL_5_20`, `QUINCENAL_10_25`, `QUINCENAL_15_30`.
- Estados de eventos financieros: `PENDIENTE`, `ATRASADO`, `MORA`, `PAGADO`, `CANCELADO_POR_ABONO`.
- La clasificación operativa de atraso se calcula en función de la fecha programada frente al día de corte actual.

## 5. Reversibilidad financiera y snapshots inmutables

Toda alteración del plan de pagos original debe ser atómica y reversible:

- **Abonos a capital:** Registran un `AbonoSnapshot` con versión de algoritmo, estado previo de cuotas (`eventosAntes`), estado resultante (`eventosDespues`) y usuario responsable.
- **Extensiones de plazo:** Registran un `ExtensionPlazoSnapshot` con `creditoAntes`, `creditoDespues`, cuotas recalculadas y cuotas creadas. Permiten reversión determinista (`revertidoEn`, `revertidoPor`, `motivoReversion`).
- Toda reversión restablece exactamente los saldos y estados previos sin dejar cuotas huérfanas.

## 6. Eliminación lógica y auditoría

- **Nunca eliminación física de créditos:** La eliminación de créditos en la interfaz es un soft-delete trazable (`eliminadoEn`, `eliminadoPor`, `motivoEliminacion`).
- Toda acción sensible (creación, edición, abonos, extensiones, transferencias, cancelaciones y eliminaciones) genera un registro inmutable en `AuditLog` con actor, entidad, acción, payload anterior y posterior.

## 7. Exportación y reportería

- Los filtros facetados de créditos y clientes permiten búsqueda combinada por estado, dueño de cartera, rangos de mora y montos.
- La exportación a Excel (`/api/creditos/exportar-resultados`) opera mediante streaming estructurado vía `exceljs`, aplicando exactamente los mismos criterios facetados y respetando el alcance de autorización del usuario.

## 8. Condiciones de producción

- El despliegue se gestiona vía Docker Compose (`docker-compose.prod.yml`) con servicios: `web` (Next.js runner), `migrate` (Prisma migrator), `postgres` (PostgreSQL 18.4) y `caddy` (reverse proxy SSL).
- **Nunca `prisma migrate dev` en producción:** las migraciones se aplican con `prisma migrate deploy` a través del servicio migrator.
- Variables de entorno críticas (`DATABASE_URL`, `AUTH_SECRET`, credenciales Google Drive, cron secrets) residen en `.env.prod`.
- El runbook operativo y protocolo de entrega se detallan en [`docs/estado/operacion.md`](file:///home/deploy/apps/lopest/docs/estado/operacion.md).

---

**Changelog:** 30-ago-2026 — Eliminación de duplicaciones de taxonomía y protocolos operativos; centralización canónica de Lopest.
