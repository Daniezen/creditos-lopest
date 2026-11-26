import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { reconcileClientDocuments } from "@/server/drive/client-documents-reconciliation.service";
import {
  trashDriveFile,
  uploadClientDocumentToDrive,
} from "@/server/drive/google-drive.service";

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class DocumentUploadServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DocumentUploadServiceError";
  }
}

interface UploadClientDocumentInput {
  clienteId: string;
  file: File;
  actorUserId: string;
}

export interface UploadClientDocumentOutput {
  documento: {
    id: string;
    nombreArchivo: string;
    mimeType: string | null;
    tamanoBytes: number | null;
    url: string;
    creadoEn: Date;
  };
  carpetaUrl: string;
}

/**
 * Handles end-to-end client document upload:
 * 1. Validates file constraints (mime, size).
 * 2. Uploads binary to client folder in Google Drive.
 * 3. Persists DocumentoCliente, updates Cliente.carpetaAdjuntosUrl, and records AuditLog atomically.
 * 4. Triggers best-effort Drive reconciliation.
 * 5. Compensates by trashing Drive file if Postgres persistence fails.
 */
export async function processClientDocumentUpload(
  input: UploadClientDocumentInput,
): Promise<UploadClientDocumentOutput> {
  const { clienteId, file, actorUserId } = input;

  if (!(file instanceof File)) {
    throw new DocumentUploadServiceError("Selecciona un archivo válido.", 400);
  }

  const maxBytes = getPositiveIntegerEnv(
    "DOCUMENT_UPLOAD_MAX_BYTES",
    10 * 1024 * 1024,
  );

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new DocumentUploadServiceError(
      "Solo se permiten PDF, JPG, PNG y WEBP.",
      415,
    );
  }

  if (file.size <= 0 || file.size > maxBytes) {
    throw new DocumentUploadServiceError(
      `El archivo debe pesar entre 1 byte y ${formatMegabytes(maxBytes)} MB.`,
      413,
    );
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      cedula: true,
      nombre: true,
      carpetaAdjuntosUrl: true,
    },
  });

  if (!cliente) {
    throw new DocumentUploadServiceError("El cliente no existe.", 404);
  }

  let uploadedDriveFileId: string | null = null;

  try {
    const upload = await uploadClientDocumentToDrive({
      cliente,
      file: {
        name: file.name,
        type: file.type,
        buffer: Buffer.from(await file.arrayBuffer()),
      },
    });
    uploadedDriveFileId = upload.fileId;

    const documento = await prisma.$transaction(async (tx) => {
      const created = await tx.documentoCliente.create({
        data: {
          clienteId,
          nombreArchivo: file.name,
          mimeType: file.type,
          tamanoBytes: file.size,
          url: upload.fileUrl,
          driveFileId: upload.fileId,
          driveFolderId: upload.folderId,
          proveedor: "GOOGLE_DRIVE",
          accionPor: actorUserId,
        },
        select: {
          id: true,
          nombreArchivo: true,
          mimeType: true,
          tamanoBytes: true,
          url: true,
          creadoEn: true,
        },
      });

      await tx.cliente.update({
        where: { id: clienteId },
        data: {
          carpetaAdjuntosUrl: upload.folderUrl,
          accionPor: actorUserId,
        },
      });

      await recordAuditLogTx(tx, {
        actorId: actorUserId,
        action: "CLIENT_DOCUMENT_UPLOAD",
        entityType: "DocumentoCliente",
        entityId: created.id,
        after: {
          clienteId,
          nombreArchivo: created.nombreArchivo,
          mimeType: created.mimeType,
          tamanoBytes: created.tamanoBytes,
          driveFileId: upload.fileId,
          driveFolderId: upload.folderId,
        } satisfies Prisma.InputJsonObject,
      });

      return created;
    });

    // PostgreSQL transaction committed. Disable compensation.
    uploadedDriveFileId = null;

    // Best-effort Drive reconciliation
    try {
      await reconcileClientDocuments({
        clienteId,
        actorId: actorUserId,
        reason: "UPLOAD",
      });
    } catch (reconciliationError) {
      console.error("Drive post-upload reconciliation failed", {
        clienteId,
        error: reconciliationError,
      });
    }

    return {
      documento,
      carpetaUrl: upload.folderUrl,
    };
  } catch (error) {
    if (uploadedDriveFileId) {
      try {
        await trashDriveFile(uploadedDriveFileId);
      } catch (compensationError) {
        console.error("Drive compensation failed", {
          driveFileId: uploadedDriveFileId,
          error: compensationError,
        });
      }
    }

    if (error instanceof DocumentUploadServiceError) {
      throw error;
    }

    console.error("Client document upload failed", { error, clienteId });
    throw new DocumentUploadServiceError(
      error instanceof Error ? error.message : "No se pudo adjuntar el archivo.",
      500,
    );
  }
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMegabytes(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

