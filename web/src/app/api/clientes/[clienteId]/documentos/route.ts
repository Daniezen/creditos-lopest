import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireClienteAccess } from "@/server/auth/scope";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import {
  trashDriveFile,
  uploadClientDocumentToDrive,
} from "@/server/drive/google-drive.service";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface RouteContext {
  params: Promise<{ clienteId: string }>;
}

/** Uploads exactly one client document per request. */
export async function POST(request: Request, context: RouteContext) {
  let uploadedDriveFileId: string | null = null;

  try {
    const { clienteId } = await context.params;
    const { user } = await requireClienteAccess(clienteId);
    assertCanMutate(user);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorResponse("Selecciona un archivo válido.", 400);
    }

    const maxBytes = getPositiveIntegerEnv(
      "DOCUMENT_UPLOAD_MAX_BYTES",
      10 * 1024 * 1024,
    );

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return errorResponse("Solo se permiten PDF, JPG, PNG y WEBP.", 415);
    }

    if (file.size <= 0 || file.size > maxBytes) {
      return errorResponse(
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

    if (!cliente) return errorResponse("El cliente no existe.", 404);

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
          accionPor: user.id,
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
          accionPor: user.id,
        },
      });

      await recordAuditLogTx(tx, {
        actorId: user.id,
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

    return NextResponse.json({
      ok: true,
      documento,
      carpetaUrl: upload.folderUrl,
    });
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

    console.error("Client document upload failed", { error });
    return errorResponse(
      error instanceof Error ? error.message : "No se pudo adjuntar el archivo.",
      500,
    );
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMegabytes(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}
