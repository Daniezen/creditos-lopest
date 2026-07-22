import { Readable } from "node:stream";

import { google, type drive_v3 } from "googleapis";

interface UploadClientDocumentInput {
  cliente: {
    cedula: string;
    nombre: string;
    carpetaAdjuntosUrl: string | null;
  };
  file: {
    name: string;
    type: string;
    buffer: Buffer;
  };
}

interface UploadClientDocumentResult {
  fileId: string;
  folderId: string;
  folderUrl: string;
  fileUrl: string;
}

const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

/** Returns a configured Drive v3 client backed by the owner's refresh token. */
function createDriveClient(): drive_v3.Drive {
  const clientId = requireEnv("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_DRIVE_CLIENT_SECRET");
  const refreshToken = requireEnv("GOOGLE_DRIVE_REFRESH_TOKEN");

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth });
}

/**
 * Uploads one file to the client's authorized folder.
 *
 * Existing folder URLs are trusted only after Drive confirms the folder is a
 * direct child of the configured root. This prevents arbitrary folder writes.
 */
export async function uploadClientDocumentToDrive(
  input: UploadClientDocumentInput,
): Promise<UploadClientDocumentResult> {
  const drive = createDriveClient();
  const rootFolderId = requireEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  const folder = await resolveClientFolder(drive, rootFolderId, input.cliente);

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
  if (!fileId) throw new Error("Drive no devolvió el identificador del archivo.");

  return {
    fileId,
    folderId: folder.id,
    folderUrl: folder.url,
    fileUrl:
      response.data.webViewLink ??
      `https://drive.google.com/file/d/${fileId}/view`,
  };
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
  rootFolderId: string,
  cliente: UploadClientDocumentInput["cliente"],
): Promise<{ id: string; url: string }> {
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
        url:
          existing.data.webViewLink ??
          `https://drive.google.com/drive/folders/${existing.data.id}`,
      };
    }

    throw new Error(
      "La carpeta vinculada no pertenece a la raíz documental autorizada.",
    );
  }

  const folderName = sanitizeFolderName(`${cliente.cedula} - ${cliente.nombre}`);
  const escapedName = folderName.replaceAll("'", "\\'");
  const query = [
    `'${rootFolderId}' in parents`,
    `name = '${escapedName}'`,
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    "trashed = false",
  ].join(" and ");

  const matches = await drive.files.list({
    q: query,
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
      url:
        matched.webViewLink ??
        `https://drive.google.com/drive/folders/${matched.id}`,
    };
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
    url:
      created.data.webViewLink ??
      `https://drive.google.com/drive/folders/${created.data.id}`,
  };
}

export function extractDriveFolderId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
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
