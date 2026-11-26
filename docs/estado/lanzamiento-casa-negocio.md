# Lanzamiento de Casa y Negocio en producción

```
ESTADO: listo para ejecutar; NADA de esto se ha corrido contra producción (26-nov-2026)
OBJETIVO: módulo en uso real el 01-dic-2026 (spec: docs/specs/casa-negocio.md)
QUIÉN EJECUTA: la sesión principal, tras fusionar las ramas del módulo y la de robustez
```

Producción solo se leyó con `SELECT` y con un `pg_dump` (lectura) para ensayar las migraciones en una
copia desechable. Todo lo que sigue se ejecuta en el VPS, como `deploy`, desde `/home/deploy/apps/lopest`.

## 0. Estado verificado

### 0.1 Migraciones pendientes contra producción

Producción tiene aplicadas las 17 migraciones hasta `20260902183700_update_overdue_dias_atraso`, todas con
`finished_at`, ninguna revertida. Faltan dos, que `prisma migrate deploy` aplica en este orden (orden
lexicográfico del nombre de carpeta, que coincide con el cronológico):

| Migración | Qué hace | Riesgo sobre datos reales |
|---|---|---|
| `20261125120000_audit_append_only_v1` | Triggers que hacen inmutables `audit_logs`, `abono_snapshots` y `extension_plazo_snapshots`; `REVOKE` de UPDATE/DELETE/TRUNCATE a `lopest_app_user` (conserva DELETE en `abono_snapshots` y UPDATE en las 3 columnas de reversión) | Sin cambio de datos ni reescritura. Bloqueo SHARE ROW EXCLUSIVE instantáneo en 3 tablas (1.437 / 197 / 20 filas). Se autoverifica y aborta si algo no quedó. |
| `20261126120000_casa_negocio_v1` | 7 enums y 10 tablas `cn_*`, CHECKs, fila de configuración y las 10 reglas de aviso | Puramente aditiva. Las FK hacia `creditos`, `eventos_financieros` y `users` viven en las tablas nuevas (bloqueo instantáneo en la referida, sin escaneo). |

Comprobado en producción (solo lectura): no existe ningún objeto `cn_*`, enum `Cn*`, función `lopest_*` ni
trigger que choque; las tablas son de `lopest_app_user` y todos sus privilegios los otorgó el propio dueño,
así que el `REVOKE` surte efecto y la verificación final de la migración no aborta. Base de 15 MB.

**Ensayo sobre copia real** (pg_dump de producción restaurado con dueños en un contenedor desechable,
`migrate deploy` conectado como `lopest_app_user`, igual que el servicio `migrate`; la copia se borró después):

- Las migraciones pendientes aplican en ~5 s; `prisma migrate diff` contra `schema.prisma` solo muestra la deriva
  previa y conocida de `abono_snapshots.eventosDespues DEFAULT`.
- Escrituras normales de la app siguen funcionando: INSERT de auditoría, UPDATE de eventos, reversión de
  extensión de plazo (marca `revertidoEn`), reversión de abono (DELETE del evento → la foto cae en cascada).
- Lo prohibido falla: UPDATE/TRUNCATE de `audit_logs` y UPDATE de otra columna de la foto de extensión
  (`permission denied`), DELETE directo de una foto de abono (trigger).
- Efecto colateral buscado: borrar físicamente un usuario con auditoría o un crédito con fotos ahora falla.
  La app no hace ninguna de las dos (usuarios se desactivan, créditos se borran lógicamente).

### 0.2 Hallazgos que cambian código (ya corregidos en esta rama)

1. **Zona horaria.** El contenedor `web` corre en **UTC** (no define `TZ`). Las fechas de Casa y Negocio
   (`dateInput`) se guardaban a la medianoche del proceso: «1-dic» quedaba en `2026-12-01T00:00Z`, que en
   Bogotá es el **30-nov a las 19:00**. Un saldo inicial o un gasto del 1-dic habría caído en noviembre.
   Ahora los esquemas del módulo guardan la medianoche de Bogotá (`D 05:00Z`) en cualquier zona; prueba
   `fechas-bogota.test.ts`. No se cambió la `TZ` del contenedor para no mover el comportamiento de Créditos.

## 1. Antes de empezar

- [ ] Ramas del módulo y de robustez fusionadas en `main`; `pnpm test` y `pnpm validate` en verde.
- [ ] **El checkout de `/home/deploy/apps/lopest` debe quedar limpio.** El build usa el árbol de trabajo, no
      el commit: hoy (26-nov) tiene archivos modificados y borrados sin commitear en `main`. Revisar
      `git status --short` y resolverlos antes de construir, o se despliegan sin querer.
- [ ] Hacerlo el **30-nov** (o antes): el 1-dic el padre debe encontrar el módulo listo para poner saldos.

## 2. Despliegue, en orden

Cada bloque se corre entero; si un comando falla, **parar** y no seguir al siguiente bloque.

### 2.1 Etiquetar las imágenes actuales (para volver atrás)

```bash
cd /home/deploy/apps/lopest
docker tag lopest-web:latest lopest-web:antes-cn-20261130
docker tag lopest-migrate:latest lopest-migrate:antes-cn-20261130
```

### 2.2 Copia de seguridad y prueba de restauración (aborta si algo falla)

```bash
cd /home/deploy/apps/lopest
mkdir -p /home/deploy/backups/lopest && chmod 700 /home/deploy/backups/lopest
set -e
bash scripts/operacion/backup-db.sh
bash scripts/operacion/prueba-restauracion.sh
cat /home/deploy/backups/lopest/ESTADO
set +e
```

- `backup-db.sh` valida el dump antes de publicarlo; `prueba-restauracion.sh` lo restaura en un contenedor
  desechable **sin red** y compara migraciones y tablas con producción: sale con código ≠ 0 si difieren.
- Debe verse `OK …` en `ESTADO` y «migraciones: restaurada 17 / producción 17». Anotar el nombre del
  `.dump`: es el punto de restauración del plan de vuelta atrás.
- Correr la prueba **antes** de migrar: después, el registro de migraciones ya no coincidiría.

### 2.3 Migrar

```bash
cd /home/deploy/apps/lopest
docker compose --env-file .env.prod -f docker-compose.prod.yml build migrate
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate
```

Debe terminar en «All migrations have been successfully applied» con las dos de §0.1. Comprobar:

```bash
docker exec lopest_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT migration_name, finished_at IS NOT NULL FROM _prisma_migrations ORDER BY 1 DESC LIMIT 2"'
```

Si falla a medias: no reintentar a ciegas. `prisma migrate deploy` deja la migración marcada como fallida;
leer el error, y si hay que deshacer, usar el bloque «Manual rollback» del encabezado de esa migración y
luego `prisma migrate resolve --rolled-back <nombre>` (o restaurar, §5).

### 2.4 Reconstruir `web`

```bash
cd /home/deploy/apps/lopest
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --force-recreate web
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

### 2.5 Semilla del módulo (cuentas, gastos del Excel, permisos)

Sin `--aplicar` es una **simulación**: calcula todo dentro de una transacción y la deshace. Los correos se
leen de `.env.prod` sin imprimirlos. Repetirla es inofensivo (solo crea lo que falta, nunca sobrescribe).

```bash
cd /home/deploy/apps/lopest
correo() { grep "^LOGIN_PROFILE_$1_EMAIL=" .env.prod | cut -d= -f2- | tr -d '"'; }
semilla() {
  docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm migrate \
    node scripts/casa-negocio-semilla.mjs --padre "$(correo PADRE)" --daniel "$(correo DANIEL)" --madre "$(correo MADRE)" "$@"
}
semilla             # simulación: revisar la lista
semilla --aplicar   # escribir
semilla --aplicar   # debe decir «ninguna / ninguno / sin cambio» en todo
```

Esperado: 5 cuentas (Efectivo, Bancolombia, Nequi, Cuenta casa, Nu · ahorro) con saldo **0.00** y fecha
1-dic, 14 gastos, permisos «padre +4, daniel +4, madre +1» y cuenta de ahorro «Nu · ahorro». El saldo 0 no
es un saldo inventado: es «todavía sin saldo real»; el padre lo pone en Configuración (§3).

La semilla rechaza correos repetidos y avisa (sin quitar nada) si alguien tiene permisos de más.

### 2.6 Copia diaria automática

Seguir `docs/estado/operacion.md` §9.3 (crontab de `deploy`: copia diaria y prueba semanal). Al día
siguiente comprobar `cat /home/deploy/backups/lopest/ESTADO`.

### 2.7 Comprobaciones en vivo

```bash
APP=https://lopest.13-140-148-38.sslip.io
curl -fsS "$APP/api/salud"; echo                          # "estado":"ok" (o "degradado" si un cron va tarde)
curl -sI "$APP/" | grep -iE 'strict-transport|content-security-policy|x-frame|x-content-type|referrer-policy|permissions-policy'
for r in "" /resumen /casa /negocio /ahorro /arqueo /configuracion; do
  curl -s -o /dev/null -w "%{http_code} /casa-negocio$r\n" "$APP/casa-negocio$r"     # sin sesión: redirección (3xx) al login, nunca 500
done
docker logs --since 15m lopest_web 2>&1 | grep -E '"level":"(error|warn)"' | tail -n 20   # vacío o explicable
```

Deben aparecer las seis cabeceras de seguridad. Luego, en el navegador (lo hace el usuario):

- [ ] Login con Google de Daniel, del padre y de la madre.
- [ ] Daniel y el padre: las siete pestañas abren (Tablero, Resumen, Casa, Negocio, Ahorro, Arqueo,
      Configuración) y ven el botón **Anotar**.
- [ ] La madre: ve el módulo, **no** ve Anotar ni puede guardar en Configuración.
- [ ] Créditos, Clientes, Simulador, Transferencias y Reportes siguen igual (registrar un pago de prueba no
      hace falta: el ensayo de §0.1 ya cubrió las escrituras).

## 3. Saldos iniciales — pasos para el papá

Esto se hace **el 1 de diciembre, antes de anotar cualquier gasto o cobro de ese día**. El saldo inicial es
lo que hay en cada cuenta **al empezar el 1-dic** (lo mismo que quedó al cerrar el 30-nov).

1. Entre a Lopest con su cuenta de Google y abra **Casa y Negocio → Configuración**.
2. En **Cuentas** verá: Efectivo, Bancolombia, Nequi (negocio) y Cuenta casa, Nu · ahorro (casa), todas en $ 0.
3. Toque **Efectivo**. En **Saldo inicial** escriba la plata que hay, sin signo pesos: por ejemplo
   `1.250.000`. Deje **Fecha del saldo** en **01/12/2026**. Toque **Guardar**.
4. Repita con cada cuenta. Para los bancos y Nequi use el saldo que muestra la app del banco esa mañana.
5. Debajo del formulario aparece «Saldo hoy»: debe coincidir con lo que acaba de escribir mientras no haya
   movimientos.
6. **¿Se equivocó?** Vuelva a tocar la cuenta, corrija el número y guarde. Se puede corregir cuando quiera,
   también después de haber anotado gastos: todos los saldos se recalculan solos. Lopest guarda quién lo
   cambió y cuándo.
7. **No cambie la fecha del saldo** después de empezar a anotar: lo que quede antes de la fecha nueva deja
   de contar en esa cuenta. Corrija solo el número.
8. Si sale «Otro usuario modificó este registro mientras lo editabas…», recargue la página y vuelva a
   escribirlo (pasa si la tenía abierta en otro celular o si alguien más la cambió).

Probado de punta a punta en una base desechable con el mismo flujo del formulario y el contenedor en UTC
(`saldos-iniciales.integration.test.ts`): guardar, ver, corregir, formulario viejo rechazado, madre rechazada.

## 4. Avisos por Telegram (pendiente, fuera de este lanzamiento)

Por decisión del usuario (26-nov) no entran en el arranque. Los avisos se ven en la app, junto a lo que
afectan. Queda para después, cuando haya bot y `chat_id`: un cron que evalúe los avisos del día con
`evaluarMes`, respete el encendido/apagado de Configuración, envíe solo los nuevos (memoria de enviados, una
migración aditiva) y un flujo n8n schedule → endpoint → Telegram, apagado hasta tener las credenciales. Ya
hubo una primera versión probada en la rama `claude/cn-lanzamiento-de71d2` (commit `561867b`, revertido en
`7b3f3af`) que se puede recuperar con `git revert 7b3f3af 99a7645`.

## 5. Volver atrás

Las migraciones son aditivas y el código anterior no toca `cn_*`: **en casi todos los casos basta con volver
a la imagen anterior y dejar la base como está.**

```bash
cd /home/deploy/apps/lopest
docker tag lopest-web:antes-cn-20261130 lopest-web:latest
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-build --force-recreate web
```

Restaurar la base **solo** si hubo daño en datos de Créditos (no por un fallo de Casa y Negocio, cuyas
anotaciones se perderían): procedimiento de `docs/estado/operacion.md` §9.6 con el `.dump` anotado en §2.2.
Si solo se quieren quitar los objetos del módulo, usar los bloques «Manual rollback» de las migraciones en
orden inverso (casa_negocio_v1 → audit_append_only_v1).

## 6. Lo que solo pone el usuario

- Más adelante: token del bot de Telegram y `chat_id` del chat familiar (§4).
- Los saldos reales de cada cuenta el 1-dic (§3, lo hace el papá).
- Revisión en el navegador con los tres usuarios (§2.7) y del Tablero el primer día.
- Confirmar los montos y días de los 14 gastos sembrados desde el Excel (Configuración → Gastos).

## 7. Riesgos abiertos

- **Alcance por persona en lo que viene de Créditos.** Cobros, cartera e intereses del módulo siguen el
  alcance de Créditos: ADMIN ve todo, el resto solo sus créditos. En producción el papá es `OPERADOR` (dueño
  de 533 créditos) y la mamá `OPERADOR` (dueña de 40); Daniel es ADMIN. Así, la ganancia del negocio que ve
  el papá **no incluye** los intereses de los créditos de la mamá, y la de Daniel sí. Los saldos de cuentas
  sí son iguales para todos. Decidir antes del 1-dic si el papá debe ser ADMIN.
- `vista-resumen.integration.test.ts` falla hoy en la proyección de 2026-12 (esperado 210.000.020,
  recibido 200.000.020), también sin los cambios de esta rama: depende de la fecha y lo debe revisar la
  sesión de Resumen. Las demás integraciones del módulo pasan contra PostgreSQL.
- Árbol de trabajo sucio en el checkout de producción (§1).
