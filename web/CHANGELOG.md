# Changelog

Versiones de Lopest Créditos. Cada versión agrupa sus cambios por módulo y se lee también en la app, en Novedades. Contrato del formato y flujo de publicación: `docs/specs/versiones.md`.

## [Sin publicar]
### General
- Añadida la versión de la plataforma al pie del menú lateral, que abre Novedades: la lista de versiones con lo que cambió en cada módulo.
- Mejorada la seguridad de la aplicación: el navegador recibe protecciones adicionales y cualquier página nueva queda privada por defecto.
### Clientes
- Mejorados los formularios de clientes: los datos se revisan antes de guardar y los errores se muestran junto a cada campo.
- Añadido el aviso cuando otra persona modificó el mismo cliente mientras lo editabas, para no sobrescribir sus cambios.
### Créditos
- Mejorados los formularios de créditos, pagos, abonos y plazos: los datos se revisan antes de guardar y los errores se muestran junto a cada campo.
- Añadido el aviso cuando otra persona modificó el mismo crédito mientras lo editabas, para no sobrescribir sus cambios.
- Corregido el registro doble de un abono al hacer doble clic o al reintentar con mala conexión.
### Reportes
- Cambiadas las gráficas de evolución y proyección a Apache ECharts, más nítidas y adaptadas al tamaño de la pantalla.
### Técnico
- Sustituido Recharts por Apache ECharts 6.0.0 detrás del componente único `Chart` de `web/src/design-system/`, con tema construido desde los tokens.
- Añadidas cabeceras de seguridad (HSTS, CSP base, sin `x-powered-by`), comparación de secretos de cron en tiempo constante y `src/proxy.ts` con rutas públicas explícitas (default-deny).
- Añadidos el logger estructurado `server/observability/log.ts`, el endpoint público `/api/salud` y los flujos n8n de salud diaria y alertas por Telegram (sin importar).
- Añadida la migración que hace append-only `audit_logs` y los snapshots de abonos y plazos (pendiente de aplicar en producción).
- Añadidos `scripts/operacion/backup-db.sh` y `prueba-restauracion.sh`, con su runbook en `docs/estado/operacion.md` §9 (cron pendiente de activar).
- Añadida validación con zod en Server Actions y route handlers, bloqueo optimista sobre `updatedAt` e idempotencia en el registro de abonos.
- Añadido el sistema de versiones: `web/CHANGELOG.md` como fuente única, el parser `features/versiones/changelog-format.ts` (sin imports, ejecutable por Node con type stripping), el validador `scripts/versiones/check-changelog.mjs` antes de `next build` y el publicador `pnpm version:publicar`. La imagen copia `CHANGELOG.md` junto a `server.js`, y la ruta `/novedades` lo lee en servidor; la sección Técnico y el bloque sin publicar solo llegan a ADMIN.

## [1.0.0] - 2026-09-02
### General
- Añadido el ingreso con la cuenta de Google, con la foto de cada persona y cierre de sesión desde el menú.
- Añadido el menú de navegación que se adapta a cada pantalla: barra lateral en computador, menú desplegable en tableta y barra inferior en el celular.
- Añadidos los accesos rápidos «Nuevo crédito» y «Nuevo cliente» desde cualquier pantalla.
- Añadida la identidad de Lopest (logo, colores e ícono del navegador) en toda la aplicación.
- Añadidos los permisos por persona: cada quien ve y modifica solo los clientes y créditos que le pertenecen, salvo los administradores.
### Simulador
- Añadido el simulador de créditos, que calcula sin guardar nada el cronograma de cuotas, los intereses, el capital y el saldo proyectado.
### Clientes
- Añadida la cartera de clientes con buscador, filtros, número de clientes activos y paginación.
- Añadida la ficha de cada cliente con sus datos de contacto, sus créditos y el resumen de su cartera.
- Añadida la carga de documentos del cliente a Google Drive, con revisión periódica que avisa cuando un archivo ya no está en Drive sin borrar su registro.
### Créditos
- Añadida la creación de créditos paso a paso, eligiendo el cliente y revisando el cronograma antes de guardar.
- Añadida la biblioteca de créditos con filtros, totales de la cartera, paginación y filtro por número de cuotas vencidas.
- Añadida la descarga a Excel de los créditos filtrados, por ejemplo los que tienen cuotas en mora.
- Añadido el detalle de cada crédito con su cronograma, el estado de cada cuota y el historial de abonos extraordinarios a capital.
- Añadido el registro de pagos con fecha real de pago, y el marcado automático de las cuotas vencidas.
- Añadidos los abonos a capital y las extensiones de plazo, que recalculan el plan de pagos y se pueden revertir.
- Añadida la edición de créditos con reglas que protegen lo que ya tiene pagos registrados.
- Añadida la eliminación de créditos con motivo obligatorio: el crédito sale de la vista pero queda registrado quién lo eliminó y por qué, y se avisa antes de crear un crédito duplicado.
### Transferencias
- Añadido el panel de transferencias para pasar un cliente completo o créditos individuales a otra persona, con registro de cada movimiento.
### Reportes
- Añadido el panel de reportes con gráficas propias de la app, en tres pestañas: resumen de la cartera, evolución y proyección, y control de riesgo.
- Añadido el control de riesgo con los días de atraso calculados al momento, los tramos de mora y los créditos con mayor monto y mayor atraso.
### Técnico
- Añadida la base: Next.js con App Router, Prisma 7 sobre PostgreSQL, NextAuth con Google y despliegue con Docker Compose y Caddy en la VPS.
- Añadido el motor puro de simulación de créditos y la persistencia transaccional del crédito con su cronograma.
- Añadida la migración de la cartera histórica desde Google Sheets y el marcado automático de cuotas vencidas por cron.
- Añadido el alcance por propietario (`Cliente.ownerUserId`, `Credito.ownerUserId`) en consultas y mutaciones, con transferencias auditadas.
- Añadidos los snapshots reversibles `AbonoSnapshot` y `ExtensionPlazoSnapshot`, con backfill de los abonos históricos.
- Añadida la reconciliación de documentos con Google Drive (`DocumentoCliente.driveDisponible`).
- Añadido el contrato de diseño en `web/src/design-system/` (tokens, recetas y contratos) y su aplicación a clientes y créditos.
- Añadido el borrado lógico de créditos (`eliminadoEn`, `eliminadoPor`, `motivoEliminacion`).
- Sustituido Looker Studio por gráficas nativas con Recharts, con fechas normalizadas a la zona horaria de Bogotá y cálculo de capital e intereses en SQL.
- Corregido el formulario de abonos, que ahora usa el estado de la acción del servidor y normaliza la zona horaria de las fechas.
