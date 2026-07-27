import { Readable } from "node:stream";

import { google, type drive_v3 } from "googleapis";

interface ClientFolderIdentity {
  cedula: string;
  nombre: string;
  carpetaAdjuntosUrl: string | null;
}

interface UploadClientDocumentInput {
  cliente: ClientFolderIdentity;
  file: {
    name: string;
    type: string;
    buffer: Buffer;
  };
}

export interface DriveClientFile {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  webViewLink: string;
  createdTime: Date | null;
  modifiedTime: Date | null;
}

interface ClientFolderResult {
  id: string;
  url: string;
}

interface UploadClientDocumentResult {
  fileId: string;
  folderId: string;
  folderUrl: string;
  fileUrl: string;
}

const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/** Returns a Drive v3 client backed by the owner's offline refresh token. */
function createDriveClient(): drive_v3.Drive {
  const auth = new google.auth.OAuth2(
    requireEnv("GOOGLE_DRIVE_CLIENT_ID"),
    requireEnv("GOOGLE_DRIVE_CLIENT_SECRET"),
  );
  auth.setCredentials({
    refresh_token: requireEnv("GOOGLE_DRIVE_REFRESH_TOKEN"),
  });
  return google.drive({ version: "v3", auth });
}

/** Uploads one file to the client's authorized folder. */
export async function uploadClientDocumentToDrive(
  input: UploadClientDocumentInput,
): Promise<UploadClientDocumentResult> {
  const drive = createDriveClient();
  const folder = await resolveClientFolder(drive, input.cliente, true);

  const response = await drive.files.create({
    requestBody: {
      name: sanitizeFileName(input.file.name),
      parents: [folder.id],
    },
    media: {
      mimeType: input.file.type,
      body: Readable.from(input.file.buffer),
    },
    fields: "id,webViewLink",
  });

  const fileId = response.data.id;
  if (!fileId) throw new Error("Drive no devolvio el identificador del archivo.");

  return {
    fileId,
    folderId: folder.id,
    folderUrl: folder.url,
    fileUrl: response.data.webViewLink ?? buildFileUrl(fileId),
  };
}

/** Lists every direct, non-trashed file in the client's Drive folder. */
export async function listClientFolderFiles(
  cliente: ClientFolderIdentity,
): Promise<{ folder: ClientFolderResult; files: DriveClientFile[] }> {
  const drive = createDriveClient();
  const folder = await resolveClientFolder(drive, cliente, false);
  const files: DriveClientFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: [
        `'${folder.id}' in parents`,
        "trashed = false",
        `mimeType != '${DRIVE_FOLDER_MIME_TYPE}'`,
      ].join(" and "),
      fields:
        "nextPageToken,files(id,name,mimeType,size,webViewLink,createdTime,modifiedTime)",
      pageSize: 1000,
      pageToken,
      orderBy: "createdTime desc",
    });

    for (const file of response.data.files ?? []) {
      if (!file.id || !file.name) continue;
      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType ?? null,
        sizeBytes: parseDriveSize(file.size),
        webViewLink: file.webViewLink ?? buildFileUrl(file.id),
        createdTime: parseDriveDate(file.createdTime),
        modifiedTime: parseDriveDate(file.modifiedTime),
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { folder, files };
}

/** Best-effort compensation when database persistence fails after upload. */
export async function trashDriveFile(fileId: string): Promise<void> {
  const drive = createDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    fields: "id,trashed",
  });
}

async function resolveClientFolder(
  drive: drive_v3.Drive,
  cliente: ClientFolderIdentity,
  createIfMissing: boolean,
): Promise<ClientFolderResult> {
  const rootFolderId = requireEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  const existingId = extractDriveFolderId(cliente.carpetaAdjuntosUrl);

  if (existingId) {
    const existing = await drive.files.get({
      fileId: existingId,
      fields: "id,mimeType,parents,trashed,webViewLink",
    });

    if (
      existing.data.id &&
      existing.data.mimeType === DRIVE_FOLDER_MIME_TYPE &&
      existing.data.trashed !== true &&
      existing.data.parents?.includes(rootFolderId)
    ) {
      return {
        id: existing.data.id,
        url: existing.data.webViewLink ?? buildFolderUrl(existing.data.id),
      };
    }

    throw new Error(
      "La carpeta vinculada no pertenece a la raiz documental autorizada.",
    );
  }

  const folderName = sanitizeFolderName(`${cliente.cedula} - ${cliente.nombre}`);
  const escapedName = folderName.replaceAll("'", "\\'");
  const matches = await drive.files.list({
    q: [
      `'${rootFolderId}' in parents`,
      `name = '${escapedName}'`,
      `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
      "trashed = false",
    ].join(" and "),
    fields: "files(id,webViewLink)",
    pageSize: 2,
  });

  if ((matches.data.files?.length ?? 0) > 1) {
    throw new Error("Drive contiene varias carpetas candidatas para el cliente.");
  }

  const matched = matches.data.files?.[0];
  if (matched?.id) {
    return {
      id: matched.id,
      url: matched.webViewLink ?? buildFolderUrl(matched.id),
    };
  }

  if (!createIfMissing) {
    throw new Error("El cliente no tiene una carpeta documental en Drive.");
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [rootFolderId],
    },
    fields: "id,webViewLink",
  });

  if (!created.data.id) throw new Error("Drive no pudo crear la carpeta del cliente.");
  return {
    id: created.data.id,
    url: created.data.webViewLink ?? buildFolderUrl(created.data.id),
  };
}

export function extractDriveFolderId(url: string | null): string | null {
  if (!url) return null;
  return url.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

function parseDriveSize(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseDriveDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function buildFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function sanitizeFileName(value: string): string {
  const sanitized = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return sanitized.slice(0, 180) || "documento";
}

function sanitizeFolderName(value: string): string {
  return value.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 180);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable requerida ${name}.`);
  return value;
}
