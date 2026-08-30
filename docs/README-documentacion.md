# Documentación de Créditos Lopest — Índice

## Estructura

```
GEMINI.md                                  → Raíz del repositorio (directrices operativas)
docs/
├── contexto-canonico.md                   → Conocimiento de dominio y decisiones estables
├── README-documentacion.md                → Índice y taxonomía de documentación
├── design-system/
│   ├── universal-design-contract.md       → Contrato universal de diseño y experiencia
│   └── lopest-product-profile.md          → Perfil visual, tokens y reglas de vistas Lopest
├── specs/
│   ├── cartera-clientes.md                → Clientes, estados documentales y transferencias
│   ├── creditos-amortizaciones.md         → Ciclo de créditos, cuotas, amortizaciones y Excel
│   ├── abonos-extensiones.md              → Abonos a capital, prórrogas y snapshots reversibles
│   ├── autenticacion-auditoria.md         → Roles, NextAuth, ownership multi-cartera y AuditLog
│   └── reconciliacion-drive.md            → Sincronización y reconciliación con Google Drive
└── estado/
    ├── handoff.md                         → Estado del corte, evidencia y acción inmediata
    ├── plan-ejecucion.md                  → Cola ordenada de unidades de trabajo
    ├── operacion.md                       → Runbook operativo, despliegue y entrega segura
    └── backlog-diseno.md                  → Propuestas de diseño y mejoras sin ratificar
```

## Qué contiene cada documento

| Documento | Propiedad | Volatilidad | Estado |
|---|---|---|---|
| `contexto-canonico.md` | Decisiones estables, reglas de negocio y fronteras | Baja | — |
| `specs/cartera-clientes.md` | Gestión operativa de clientes, carteras y filtros facetados | Media | Implementado |
| `specs/creditos-amortizaciones.md` | Plan de pagos, modalidades de amortización y exportación Excel | Media | Implementado |
| `specs/abonos-extensiones.md` | Abonos a capital, extensiones de plazo y snapshots reversibles | Media | Implementado |
| `specs/autenticacion-auditoria.md` | Gobierno de permisos, NextAuth y auditoría transaccional | Media | Implementado |
| `specs/reconciliacion-drive.md` | Reconciliación periódica y estado de archivos en Drive | Media | Implementado |
| `design-system/universal-design-contract.md` | Contrato universal de UI y experiencia de producto | Baja | Contrato |
| `design-system/lopest-product-profile.md` | Perfil visual de Lopest, Geist, shell y tablas | Media | Contrato |
| `estado/handoff.md` | Estado del corte, evidencia demostrada y **una** acción inmediata | **Alta** | — |
| `estado/plan-ejecucion.md` | Cola ordenada de unidades de trabajo pendientes | **Alta** | — |
| `estado/operacion.md` | Runbook: Docker Compose, despliegue, entrega segura y scripts | Baja | — |
| `estado/backlog-diseno.md` | **Propuestas de diseño sin ratificar** | Alta | No es contrato |

## Precedencia ante contradicción

1. Decisión aprobada explícita
2. Esquema Prisma y migraciones vigentes
3. Especificación vigente del dominio
4. Contrato y perfil de diseño (`docs/design-system/`)
5. Código publicado
6. Pruebas automatizadas (Vitest)
7. Handoff fechado
8. Documentos históricos
9. Backlog de diseño *(no es vinculante)*

## Reglas del conjunto

- **Un solo propietario por tema.** Los demás documentos referencian, no repiten.
- **La metodología general vive en las skills:** ciclo de trabajo, estándar de código y comentarios, arquitectura y fronteras de herramientas, diseño y experiencia, entrega y operación, reproducibilidad.
- Cada spec describe el modelo de dominio, reglas invariantes, contratos de API/Server Actions y tablas de **verificación contra código**.
- Cada documento incluye un **changelog** de cierre.

---

**Changelog:** 30-ago-2026 — Reestructuración del índice documental adaptado íntegramente a Plataforma Créditos Lopest.
