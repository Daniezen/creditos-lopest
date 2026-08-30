# Especificación funcional — Autenticación, Roles, Gobierno de Cartera y Auditoría

```
ESTADO:    Implementado y operativo
CORTE:     30-ago-2026
EVIDENCIA: web/src/server/auth/ y web/src/server/audit/ (guards de servidor y registro de auditoría validados)
```

## 1. Propósito y alcance

Define el esquema de autenticación (NextAuth con proveedores Google OAuth y credenciales), el gobierno de permisos basado en roles técnicos, el aislamiento multi-cartera por propietario y la trazabilidad transaccional mediante `AuditLog`.

## 2. Autenticación (`User`, `OauthAccount`)

- **Autenticación:** Implementada con `next-auth` en Next.js App Router (`/api/auth/[...nextauth]`).
- Soporta inicio de sesión mediante Google OAuth y perfiles operativos configurados en servidor.
- La sesión inyecta en el contexto de servidor el ID de usuario, correo, nombre y roles asignados.

## 3. Roles y Autorización (`Role`, `UserRole`)

- **`Role.code` (Regla Dura de Backend):** Toda validación de autorización en Server Actions, Route Handlers y consultas Prisma se efectúa exclusivamente contra el código técnico del rol (`ADMIN`, `OPERADOR`, etc.).
- **`Role.name`:** Nombre descriptivo para presentación visual en el dashboard / topbar. Nunca se utiliza en condiciones booleanas ni sentencias `if`.
- **Principio de Mínimo Privilegio:** Autenticación ≠ Autorización. La presencia de sesión válida no otorga acceso a recursos ajenos sin comprobación explícita de ownership o rol directivo.

## 4. Gobierno y Aislamiento de Cartera (`ownerUserId`)

- **Separación de Niveles:**
  - `Cliente.ownerUserId`: Propietario documental y gestor principal del cliente.
  - `Credito.ownerUserId`: Dueño de la colocación financiera y acreedor del crédito.
- **Consultas con Alcance (`Scope`):**
  - Usuarios estándar solo visualizan y operan clientes y créditos asignados a su `ownerUserId`.
  - Roles con permiso global (`ADMIN`) pueden consultar la cartera consolidada y ejecutar reasignaciones.

## 5. Auditoría Transaccional (`AuditLog`)

Toda mutación de estado financiero o de cartera debe registrar un evento inmutable en `AuditLog`:

| Campo | Propósito |
|---|---|
| `actorId` | ID del usuario autenticado que ejecutó la acción. |
| `action` | Nombre de la operación (`CREATE_CREDIT`, `APPLY_ABONO`, `EXTEND_TERM`, `DELETE_CREDIT`, `TRANSFER_OWNER`, etc.). |
| `entityType` | Modelo afectado (`Credito`, `Cliente`, `EventoFinanciero`, `DocumentoCliente`). |
| `entityId` | Identificador único del registro afectado. |
| `before` | Instantánea JSON del estado previo. |
| `after` | Instantánea JSON del estado resultante. |
| `reason` | Motivo explícito proporcionado por el usuario (obligatorio en eliminaciones y reversiones). |
| `ipAddress` / `userAgent` | Metadatos de red de la petición. |

## 6. Verificación contra código

| Afirmación | Archivo de referencia | Estado |
|---|---|---|
| Guards y validación de sesión de servidor | `web/src/server/auth/guards.ts` | Verificado |
| Alcance y filtros de propiedad (`Scope`) | `web/src/server/auth/scope.ts` | Verificado |
| Servicio de registro de auditoría | `web/src/server/audit/audit-log.ts` | Verificado |
| Extensiones de tipos de sesión NextAuth | `web/src/types/next-auth.d.ts` | Verificado con typecheck |

---

**Changelog:** 30-ago-2026 — Especificación canónica de autenticación, roles, cartera y auditoría.
