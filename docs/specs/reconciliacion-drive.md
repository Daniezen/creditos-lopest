# Especificación funcional — Reconciliación Documental con Google Drive

```
ESTADO:    Implementado y operativo
CORTE:     30-ago-2026
EVIDENCIA: web/src/server/drive/ y /api/cron/documentos/sincronizar (servicios y reconciliación validados)
```

## 1. Propósito y alcance

Gestiona el almacenamiento, sincronización y reconciliación de documentos adjuntos de clientes (pagarés, documentos de identidad, comprobantes) almacenados externamente en Google Drive.

## 2. Modelo de datos (`DocumentoCliente`)

- `clienteId`: Enlace al cliente propietario del archivo.
- `nombreArchivo`, `mimeType`, `tamanoBytes`: Metadatos del documento.
- `url`: Enlace público o firmado para previsualización / descarga.
- `driveFileId`: Identificador único del archivo en Google Drive.
- `driveFolderId`: Identificador de la carpeta del cliente en Google Drive.
- `driveDisponible`: Booleano que indica si el archivo sigue accesible en Drive (`true` por defecto).
- `driveUltimaVerificacion`: Marca de tiempo de la última conciliación exitosa.
- `driveEliminadoEn`: Fecha en que se detectó la indisponibilidad del archivo en Drive.
- `proveedor`: `GOOGLE_DRIVE` (extensible a `LOCAL`, `S3`, etc.).

## 3. Arquitectura de Carga y Sincronización

1. **Subida de Archivos:**
   - La API de Lopest (`/api/clientes/[clienteId]/documentos`) recibe el stream de archivos y lo transfiere a la carpeta del cliente en Google Drive mediante `googleapis`.
   - Tras la confirmación en Drive, se inserta el registro en PostgreSQL (`documentos_cliente`).
   - El estado documental del cliente se actualiza automáticamente a `DOCUMENTOS_CARGADOS`.
2. **Reconciliación Periódica (Cron Job):**
   - El endpoint protegido `/api/cron/documentos/sincronizar` (requiere `DOCUMENTOS_CRON_SECRET`) recorre periódicamente los registros activos.
   - Verifica la existencia y accesibilidad de cada `driveFileId` en Google Drive.
   - Si un archivo fue borrado o trasladado fuera de la carpeta autorizada en Drive:
     - **No se borra la fila de PostgreSQL.**
     - Se actualiza `driveDisponible = false` y se registra `driveEliminadoEn = now()`.
     - Esto preserva la trazabilidad legal y financiera del documento histórico.

## 4. Verificación contra código

| Afirmación | Archivo de referencia | Estado |
|---|---|---|
| Servicio de integración Google Drive | `web/src/server/drive/google-drive.service.ts` | Verificado |
| Servicio de reconciliación de documentos | `web/src/server/drive/client-documents-reconciliation.service.ts` | Verificado |
| Panel visual de documentos del cliente | `web/src/features/clientes/documentos/components/client-documents-panel.tsx` | Verificado |
| Route handler de cron de sincronización | `web/src/app/api/cron/documentos/sincronizar/route.ts` | Verificado |

---

**Changelog:** 30-ago-2026 — Especificación de integración y reconciliación documental con Google Drive.
