import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { listClientFolderFiles } from "@/server/drive/google-drive.service";

interface ReconcileClientDocumentsInput {
  clienteId: string;
  actorId?: string | null;
  reason: "UPLOAD" | "CRON" | "BACKFILL";
}

export interface ReconcileClientDocumentsResult {
  clienteId: string;
  folderId: string;
  found: number;
  verified: number;
  imported: number;
  updated: number;
  restored: number;
  unavailable: number;
}

/**
 * Reconciles one Drive folder into PostgreSQL.
 *
 * Drive is authoritative for file presence in the authorized client folder.
 * PostgreSQL remains the searchable index and audit store. Missing files are
 * retained and marked unavailable instead of being deleted.
 */
export async function reconcileClientDocuments(
  input: ReconcileClientDocumentsInput,
): Promise<ReconcileClientDocumentsResult> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: input.clienteId },
    select: {
      id: true,
      cedula: true,
      nombre: true,
      carpetaAdjuntosUrl: true,
      documentos: {
        select: {
          id: true,
          driveFileId: true,
          nombreArchivo: true,
          mimeType: true,
          tamanoBytes: true,
          url: true,
          driveFolderId: true,
          driveDisponible: true,
        },
      },
    },
  });

  if (!cliente) throw new Error("El cliente no existe.");
  if (!cliente.carpetaAdjuntosUrl) {
    return {
      clienteId: cliente.id,
      folderId: "",
      found: 0,
      verified: 0,
      imported: 0,
      updated: 0,
      restored: 0,
      unavailable: 0,
    };
  }

  const driveInventory = await listClientFolderFiles(cliente);
  const checkedAt = new Date();
  const systemActor = input.actorId ?? "sistema-drive-sync";
  const existingByDriveId = new Map(
    cliente.documentos
      .filter((documento) => documento.driveFileId)
      .map((documento) => [documento.driveFileId as string, documento]),
  );
  const driveIds = new Set(driveInventory.files.map((file) => file.id));

  let imported = 0;
  let updated = 0;
  let restored = 0;
  let unavailable = 0;
  let verified = 0;

  await prisma.$transaction(async (tx) => {
    const unchangedIds: string[] = [];

    for (const file of driveInventory.files) {
      const existing = existingByDriveId.get(file.id);
      const synchronizedData = {
        clienteId: cliente.id,
        nombreArchivo: file.name,
        mimeType: file.mimeType,
        tamanoBytes: file.sizeBytes,
        url: file.webViewLink,
        driveFolderId: driveInventory.folder.id,
        driveDisponible: true,
        driveUltimaVerificacion: checkedAt,
        driveEliminadoEn: null,
        proveedor: "GOOGLE_DRIVE" as const,
        accionPor: systemActor,
      };

      if (!existing) {
        await tx.documentoCliente.create({
          data: {
            ...synchronizedData,
            driveFileId: file.id,
            creadoEn: file.createdTime ?? checkedAt,
          },
        });
        imported += 1;
        continue;
      }

      const wasUnavailable = !existing.driveDisponible;
      const metadataChanged =
        existing.nombreArchivo !== file.name ||
        existing.mimeType !== file.mimeType ||
        existing.tamanoBytes !== file.sizeBytes ||
        existing.url !== file.webViewLink ||
        existing.driveFolderId !== driveInventory.folder.id;

      if (wasUnavailable || metadataChanged) {
        await tx.documentoCliente.update({
          where: { id: existing.id },
          data: synchronizedData,
        });
        if (wasUnavailable) restored += 1;
        else updated += 1;
      } else {
        unchangedIds.push(existing.id);
      }
    }

    // Record successful verification with one statement, not one update per file.
    if (unchangedIds.length > 0) {
      await tx.documentoCliente.updateMany({
        where: { id: { in: unchangedIds } },
        data: { driveUltimaVerificacion: checkedAt },
      });
      verified = unchangedIds.length;
    }

    // Only newly missing files transition to unavailable. Already unavailable
    // rows are preserved without repeatedly changing timestamps or audit logs.
    const newlyUnavailableIds = cliente.documentos
      .filter(
        (documento) =>
          documento.driveFileId &&
          documento.driveDisponible &&
          !driveIds.has(documento.driveFileId),
      )
      .map((documento) => documento.id);

    if (newlyUnavailableIds.length > 0) {
      await tx.documentoCliente.updateMany({
        where: { id: { in: newlyUnavailableIds } },
        data: {
          driveDisponible: false,
          driveUltimaVerificacion: checkedAt,
          driveEliminadoEn: checkedAt,
          accionPor: systemActor,
        },
      });
      unavailable = newlyUnavailableIds.length;
    }

    if (cliente.carpetaAdjuntosUrl !== driveInventory.folder.url) {
      await tx.cliente.update({
        where: { id: cliente.id },
        data: {
          carpetaAdjuntosUrl: driveInventory.folder.url,
          accionPor: systemActor,
        },
      });
    }

    // A no-change verification is operational telemetry, not a business event.
    if (imported + updated + restored + unavailable > 0) {
      await recordAuditLogTx(tx, {
        actorId: input.actorId ?? null,
        action: "CLIENT_DOCUMENTS_RECONCILE_DRIVE",
        entityType: "Cliente",
        entityId: cliente.id,
        reason: input.reason,
        metadata: {
          folderId: driveInventory.folder.id,
          found: driveInventory.files.length,
          verified,
          imported,
          updated,
          restored,
          unavailable,
        } satisfies Prisma.InputJsonObject,
      });
    }
  });

  return {
    clienteId: cliente.id,
    folderId: driveInventory.folder.id,
    found: driveInventory.files.length,
    verified,
    imported,
    updated,
    restored,
    unavailable,
  };
}
