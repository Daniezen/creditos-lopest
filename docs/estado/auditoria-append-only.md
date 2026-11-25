# Auditoría append-only — despliegue y rollback

**Migración:** `web/prisma/migrations/20261125120000_audit_append_only_v1/migration.sql`
**Prueba de contrato:** `web/src/server/audit/__tests__/audit-append-only.contract.test.ts`
**Estado:** escrita y probada en una base desechable. **No aplicada en producción.**

## 1. Qué garantiza

| Tabla | UPDATE | DELETE | TRUNCATE | Por qué |
|---|---|---|---|---|
| `audit_logs` | Rechazado | Rechazado | Rechazado | Registro de quién hizo qué. Solo se inserta y se lee. |
| `abono_snapshots` | Rechazado | Solo en cascada desde su evento de abono | Rechazado | La reversión de abono (`features/creditos/abonos/reversal-actions.ts`) borra el evento `ABONO_CAPITAL` y el snapshot cae por `ON DELETE CASCADE`. |
| `extension_plazo_snapshots` | Solo marcar reversión, una vez | Rechazado | Rechazado | La reversión de extensión (`features/creditos/plazos/actions.ts`) escribe `revertidoEn`, `revertidoPor` y `motivoReversion`. |

Dos capas:

1. **Triggers `BEFORE`** (la garantía real hoy). Se ejecutan para todos los roles, el superusuario incluido, y también para las acciones referenciales (`CASCADE`, `SET NULL`).
2. **`REVOKE` a `lopest_app_user`**: el DML directo falla con `permission denied` antes de llegar al trigger. `abono_snapshots` conserva `DELETE`, porque la cascada corre como dueño de la tabla, y hoy ese dueño es `lopest_app_user`. `extension_plazo_snapshots` conserva `UPDATE` solo en las tres columnas de reversión.

La migración termina con un bloque que vuelve a leer el estado real y **aborta** si falta un trigger, si alguno está deshabilitado o si sobrevivió un privilegio: un `REVOKE` que no quita nada solo da un WARNING en PostgreSQL.

### Decisión sobre los snapshots

- **Abono:** no se pudo dejar inmutable del todo sin cambiar la reversión, porque esta borra físicamente el evento de abono y el snapshot se va con él (FK `abono_snapshots_abonoEventoId_fkey`, `CASCADE`). La regla del trigger es: se acepta un `DELETE` solo si el evento de abono ya no existe (es la cascada) **y** el crédito todavía existe (no es un borrado físico del crédito). El borrado directo de un snapshot se rechaza. Lo que se pierde con la reversión es la imagen JSON del snapshot; el `AuditLog` `ABONO_CAPITAL_REVERSE` guarda `snapshotId`, `codigo`, `monto` y el modo, pero no `eventosAntes`/`eventosDespues`.
- **Extensión:** la reversión es un cambio de estado (columnas `revertido*`) y no borra nada. El trigger acepta solo la transición `revertidoEn` NULL → valor, con `revertidoPor` informado, una sola vez, y comprueba (comparando las filas como `jsonb`) que ninguna otra columna cambie, incluidas las que se agreguen en el futuro.

### Efectos colaterales intencionales

- **Borrar un usuario que tiene auditoría falla**: `audit_logs_actorId_fkey` es `ON DELETE SET NULL`, que es un `UPDATE` de la fila de auditoría. Los usuarios se desactivan (`activo`), y ningún código los borra.
- **Borrar físicamente un crédito con snapshots falla**: los créditos se eliminan con soft delete (`eliminadoEn`), y ningún código hace `credito.delete`.
- Las FK no se modificaron: así no hay deriva respecto a `schema.prisma`, y los triggers ya deciden.

## 2. Estado de producción leído (25-nov-2026, solo lectura)

- Roles: `lopest_admin` (superusuario) y `lopest_app_user` (sin superusuario, `CREATEDB`).
- **`lopest_app_user` es a la vez el rol de runtime, el del migrator y el dueño de las 13 tablas y del esquema `public`.** El servicio `migrate` usa el mismo `DATABASE_URL` que `web`.
- `relacl` vacío en todas las tablas (privilegios implícitos de dueño) y sin `pg_default_acl`.
- No había triggers de usuario. Había 1437 filas en `audit_logs`, 197 en `abono_snapshots` y 20 en `extension_plazo_snapshots` (1 revertida); ningún snapshot de abono huérfano.
- El directorio `docker/postgres/init` está vacío y fuera de git; el rol de runtime se creó a mano.

Consecuencia: el migrator **sí puede** hacer el `REVOKE` (un dueño puede quitarse sus propios privilegios), pero como dueño también puede volver a darse cualquier privilegio con `GRANT` y deshabilitar triggers con `ALTER TABLE`. Por eso la garantía efectiva hoy son los triggers; los privilegios solo pasan a ser una garantía con la fase 2 (§5).

## 3. Despliegue

Todo desde `/home/deploy/apps/lopest`, en una ventana sin operaciones de cartera en curso. La migración no cambia datos; los triggers toman un lock `SHARE ROW EXCLUSIVE` breve por tabla.

1. **Pre-chequeo (solo lectura).** Debe listar solo `20261125120000_audit_append_only_v1` como pendiente y ningún snapshot huérfano:
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate pnpm exec prisma migrate status
   ```
   ```bash
   set -a; . ./.env.prod; set +a; docker exec -e PGOPTIONS='-c default_transaction_read_only=on' lopest_db psql -X -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_APP_DB" -c "select count(*) from abono_snapshots s where not exists (select 1 from eventos_financieros e where e.id = s.\"abonoEventoId\");"
   ```
2. **Respaldo** completo:
   ```bash
   set -a; . ./.env.prod; set +a; docker exec lopest_db pg_dump -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_APP_DB" -Fc > "backups/lopest_core_$(date +%Y%m%d_%H%M%S)_pre_audit_append_only.dump"
   ```
3. **Ensayo obligatorio sobre una copia.** Restaura el respaldo en un contenedor desechable `postgres:18.4-alpine` con la misma topología (rol `lopest_app_user` dueño del esquema `public`) y aplica la migración allí con `prisma migrate deploy` como `lopest_app_user`. Comprueba que, como ese rol:
   - `UPDATE`/`DELETE`/`TRUNCATE` sobre `audit_logs` fallan;
   - `DELETE FROM eventos_financieros WHERE id = <abono con snapshot>` borra el evento y su snapshot;
   - el `UPDATE` de las tres columnas `revertido*` de un snapshot de extensión no revertido funciona una vez y falla la segunda.
   Después elimina el contenedor.
4. **Aplicar** en producción (reconstruye la imagen del migrator para que incluya la migración):
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml build migrate
   ```
   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate
   ```
5. **Post-chequeo (solo lectura).** Deben salir 6 triggers con `tgenabled = O`, y `lopest_app_user` debe conservar solo `INSERT, REFERENCES, SELECT, TRIGGER` en `audit_logs`, más `DELETE` en `abono_snapshots`:
   ```bash
   set -a; . ./.env.prod; set +a; docker exec -e PGOPTIONS='-c default_transaction_read_only=on' lopest_db psql -X -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_APP_DB" -c "select tgrelid::regclass, tgname, tgenabled from pg_trigger where not tgisinternal order by 1,2;" -c "select table_name, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where grantee = 'lopest_app_user' and table_name in ('audit_logs','abono_snapshots','extension_plazo_snapshots') group by 1;"
   ```
6. **Verificación funcional en la app:** registrar un pago o abono deja su fila en `audit_logs` (como antes). La primera reversión real de abono o de extensión debe funcionar; si falla con `append-only:`, aplica el rollback (§4) y repórtalo.

### Si la migración falla a mitad

`prisma migrate deploy` la marca como fallida y bloquea las siguientes. El mensaje dice qué faltó (`append-only guard triggers missing or disabled` o `lopest_app_user can still rewrite append-only tables`, con un HINT). Corrige la causa (por ejemplo, revoca el privilegio como el rol que lo otorgó) y luego:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate pnpm exec prisma migrate resolve --rolled-back 20261125120000_audit_append_only_v1
```
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate
```
La migración es idempotente: reaplicarla converge. `CREATE OR REPLACE TRIGGER` incluso vuelve a habilitar un trigger deshabilitado.

## 4. Rollback

Solo si una operación legítima queda bloqueada. Se ejecuta como dueño de las tablas (hoy `lopest_app_user`; `lopest_admin` también sirve). Deja el rastro en el handoff.

```sql
BEGIN;
DROP TRIGGER IF EXISTS audit_logs_append_only ON "audit_logs";
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON "audit_logs";
DROP TRIGGER IF EXISTS abono_snapshots_append_only ON "abono_snapshots";
DROP TRIGGER IF EXISTS abono_snapshots_no_truncate ON "abono_snapshots";
DROP TRIGGER IF EXISTS extension_plazo_snapshots_append_only ON "extension_plazo_snapshots";
DROP TRIGGER IF EXISTS extension_plazo_snapshots_no_truncate ON "extension_plazo_snapshots";
DROP FUNCTION IF EXISTS lopest_reject_rewrite(), lopest_abono_snapshot_guard(), lopest_extension_snapshot_guard();
GRANT UPDATE, DELETE, TRUNCATE ON "audit_logs", "abono_snapshots", "extension_plazo_snapshots" TO "lopest_app_user";
COMMIT;
```

Después, el registro de `_prisma_migrations` sigue marcando la migración como aplicada. **No lo borres:** la reinstalación se hace con una migración nueva hacia adelante que corrija la causa. La prueba de contrato impide que una migración posterior quite los triggers, así que un rollback permanente exige cambiar esa prueba de forma explícita, con su motivo.

## 5. Riesgos residuales y fase 2

- **El dueño puede desarmar la garantía.** `lopest_app_user` es el dueño de las tablas: con SQL arbitrario (por ejemplo, una inyección que llegue a DDL) puede ejecutar `ALTER TABLE ... DISABLE TRIGGER`, `GRANT` o `DROP TABLE`. Prisma Client nunca emite esas sentencias, así que un bug normal de la app queda bloqueado, pero un atacante con SQL libre no.
- **Fase 2 (separar roles, requiere a `lopest_admin` y una ventana coordinada):** crear el rol `lopest_owner NOLOGIN`, transferirle las tablas, las secuencias y el esquema `public` (`ALTER ... OWNER TO lopest_owner`), dar a `lopest_app_user` solo `SELECT, INSERT, UPDATE, DELETE` en las tablas mutables y `SELECT, INSERT` en `audit_logs` (más los permisos de este documento), fijar `ALTER DEFAULT PRIVILEGES FOR ROLE lopest_owner` y hacer que el servicio `migrate` conecte con un usuario de migración miembro de `lopest_owner`, con su propio `DATABASE_URL` en `docker-compose.prod.yml` y en `prisma.config.ts`. Con eso, el rol de runtime ya no puede deshacer ni los privilegios ni los triggers. Está fuera del alcance de esta unidad: toca la configuración de Compose y de Prisma.
- **La reversión de abono pierde el snapshot.** Si se quiere conservar la imagen, la reversión debería marcar el snapshot como revertido (columnas nuevas, como en las extensiones) en lugar de borrar el evento. Es un cambio en `features/creditos/abonos/` y en el esquema.
- **El nombre del rol está escrito a mano** (`lopest_app_user`). Si en un entorno no existe, la migración omite el `REVOKE` con un NOTICE y deja solo los triggers. En producción existe.
- **`TRIGGER` y `REFERENCES`** siguen concedidos al rol de runtime: no permiten reescribir filas, y como dueño los tendría de todos modos.

---

**Changelog:** 25-nov-2026 — Migración append-only escrita y ensayada en una base desechable (topología de producción, superusuario y sin rol de runtime). Pendiente de aplicar.
