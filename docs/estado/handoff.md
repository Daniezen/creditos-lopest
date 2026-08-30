# Handoff Técnico — Plataforma Créditos Lopest

```
CORTE:     30-ago-2026
HEAD:      8ccf642 — «feat: export filtered overdue credits to Excel» = origin/main
RAMA:      main
UNIDAD:    Ajuste y edición de fechas en abonos extraordinarios a capital, saneamiento de
           redundancias documentales y fijación de la directriz de despliegue productivo.
VALIDACIÓN: 51 pruebas unitarias y de dominio pasando en Vitest; pnpm validate (Prisma generate,
           ESLint, TypeScript, Next.js build) verificado en verde.
```

## 1. Veredicto operativo

La plataforma de gestión de créditos y cartera de clientes Lopest se encuentra **estable y completamente funcional**. Todas las mutaciones financieras críticas (abonos a capital, extensiones de plazo, transferencias de cartera y eliminaciones lógicas) cuentan con snapshots reversibles y registro inmutable en `AuditLog`.

Ahora los abonos extraordinarios a capital permiten especificar la fecha real del abono en el formulario de registro y ajustarla inline desde el historial de movimientos, con validación estricta de no-futuro y posterior a la fecha del préstamo.

## 2. Estado por Módulo / Frente

| Módulo | Estado | Evidencia o Verificación |
|---|---|---|
| Cartera de Clientes | `CERRADA` | Vistas `/clientes`, `/clientes/[id]`, métricas y 2 suites de pruebas pasando |
| Créditos y Amortizaciones | `CERRADA` | Stepper de creación, cálculo de cuotas (fija / solo interés) y tests pasando |
| Abonos a Capital | `CERRADA` | Fechas configurables/editables, snapshots inmutables y reversión con tests |
| Extensiones de Plazo | `CERRADA` | Snapshots `ExtensionPlazoSnapshot`, recalculo de cuotas y tests unitarios |
| Reconciliación Drive | `CERRADA` | Subida a Google Drive, flag `driveDisponible` y cron `/api/cron/documentos/sincronizar` |
| Eliminación Lógica | `CERRADA` | Soft-delete con motivo obligatorio y pruebas de política |
| Exportación Excel | `CERRADA` | Generación de `.xlsx` con `exceljs`, facetas y pruebas unitarias |
| Autenticación y Auditoría | `CERRADA` | NextAuth con perfiles operativos, `Role.code` en servidor y `AuditLog` |
| Sistema de Diseño | `CERRADA` | Tokens Geist, temas, recetas y vistas `/clientes` y `/creditos` adaptadas |

## 3. Capacidades Implementadas

- **Gestión de Clientes:** Cédula única, recomendador, estados documentales (`FALTAN_DOCUMENTOS` / `DOCUMENTOS_CARGADOS`), histórico de créditos y transferencia de propietario de cartera.
- **Ciclo de Créditos:** Creación idempotente con stepper en 3 pasos, cálculo automático de amortización fija y solo interés, frecuencias mensuales y quincenales (5-20, 10-25, 15-30).
- **Abonos Extraordinarios con Fecha Personalizada:** Selección de fecha real de abono al registrar y edición inline en movimientos con recálculo cronológico de saldos y trazabilidad en `AuditLog`.
- **Control de Cartera y Mora:** Detección de cuotas vencidas y días de atraso, filtros facetados en tabla e indicador de balance acumulado.
- **Reversibilidad y Auditoría:** Modificación del plan de pagos con snapshots inmutables (`AbonoSnapshot`, `ExtensionPlazoSnapshot`) que permiten auditoría completa y reversión determinista.
- **Exportación Financiera:** Descarga de reportes en Excel filtrados por estado, propietario de cartera y rangos de cuotas vencidas.
- **Reconciliación Documental:** Sincronización periódica con Google Drive preservando registros históricos en PostgreSQL si un archivo es removido externamente.

## 4. Evidencia Demostrada

| Tipo | Cobertura | Demostración |
|---|---|---|
| Pruebas Unitarias / Dominio | 13 archivos / 51 tests pasando (Vitest) | Aritmética de cuotas, políticas de reversión, cálculo de balances y facetas |
| Verificación Estática (`pnpm validate`) | Prisma generate + Lint + Typecheck + Next build | Cero errores de TypeScript, linter limpio y build compilado exitosamente |
| Base de Datos Transaccional | PostgreSQL 18.4 + Prisma 7 (`@prisma/adapter-pg`) | Integridad referencial, transacciones serializables e índices en producción |

---

## ACCIÓN INMEDIATA

**Ejecutar el despliegue en VPS:**
Compilar y levantar el contenedor `web` con `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build web` para verificar en vivo los cambios en producción.

---

**Changelog:** 31-ago-2026 — Soporte completo para fechas personalizadas y edición de abonos extraordinarios a capital, alineación de runbook a despliegue en VPS y 51 tests en verde.
