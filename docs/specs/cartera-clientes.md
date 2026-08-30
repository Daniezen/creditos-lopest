# Especificación funcional — Cartera y Gestión de Clientes

```
ESTADO:    Implementado y probado en producción
CORTE:     30-ago-2026
EVIDENCIA: web/src/features/clientes/__tests__/ (pruebas de resumen y cartera de clientes pasando)
```

## 1. Propósito y alcance

Define el modelo y la operativa de gestión de clientes en Lopest: registro, datos de contacto, asignación de cartera de propietario (`ownerUserId`), estado de documentación y consulta consolidada de balances.

## 2. Modelo de datos (`Cliente`)

- **Identificación:** `cedula` (única), `nombre`.
- **Contacto y ubicación:** `direccion`, `empresa`, `telefono`, `contacto`, `contacto2`, `recomienda` (recomendador descriptivo).
- **Documental:** `carpetaAdjuntosUrl`, `estadoDocumentos` (`FALTAN_DOCUMENTOS` | `DOCUMENTOS_CARGADOS`).
- **Gobernanza de cartera:** `ownerUserId` apunta al `User` propietario principal / documental del cliente.
- **Auditoría:** `creadoEn`, `actualizadoEn`, `accionPor`.

## 3. Reglas de negocio

1. **Unicidad de Cédula:** No se permite registrar más de un cliente con la misma cédula.
2. **Propiedad y Cartera:** `Cliente.ownerUserId` define el usuario responsable del cliente. Sin embargo, un cliente puede poseer créditos con `Credito.ownerUserId` asignados a otros usuarios según la operación financiera.
3. **Resumen Financiero Consolidado (`portfolio-summary`):**
   - Calcula capital activo, total prestado, saldo pendiente e intereses acumulados para créditos en estado `ACTIVO`.
   - Discrimina cuotas en mora y atrasadas sin alterar registros persistentes.
4. **Transferencia de Cartera:**
   - La transferencia de un cliente y/o sus créditos a otro usuario requiere confirmación explícita y genera evento de auditoría en `AuditLog`.

## 4. Comportamiento de interfaz (`/clientes`, `/clientes/[id]`)

- **Buscador:** Filtra en tiempo real mediante `q` sincronizado con URL (con debounce).
- **Filtros facetados:** Estado documental, dueño de cartera, recomendador y estado de cartera. En escritorio se operan desde los encabezados de tabla; en pantallas menores a 1200px se abren en drawer lateral o bottom sheet.
- **Detalle de Cliente (`/clientes/[id]`):** Tarjeta de métricas compactas, lista de créditos asociados, panel de documentos Drive y gestión de transferencias.

## 5. Verificación contra código

| Afirmación | Archivo de referencia | Estado |
|---|---|---|
| Cálculo consolidado de cartera de cliente | `web/src/features/clientes/client-detail-portfolio.ts` | Verificado con tests |
| Resumen de cartera general | `web/src/features/clientes/portfolio-summary.ts` | Verificado con tests |
| Acciones de servidor y mutaciones | `web/src/features/clientes/actions.ts` | Verificado con build |
| Panel de transferencias de propietario | `web/src/features/clientes/components/cliente-owner-transfer-card.tsx` | Verificado en UI |

---

**Changelog:** 30-ago-2026 — Especificación canónica de cartera y gestión de clientes.
