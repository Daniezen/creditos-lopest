import { describe, expect, it } from "vitest";

import {
  ALLOWED_MIME_TYPES,
  processClientDocumentUpload,
} from "@/server/drive/client-document-upload.service";

describe("Document upload contract and validation", () => {
  it("only allows legitimate document and image mime types", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/webp")).toBe(true);

    expect(ALLOWED_MIME_TYPES.has("text/plain")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("application/x-msdownload")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("rejects invalid or empty files with HTTP 400", async () => {
    await expect(
      processClientDocumentUpload({
        clienteId: "cli_123",
        file: null as unknown as File,
        actorUserId: "usr_123",
      }),
    ).rejects.toMatchObject({
      name: "DocumentUploadServiceError",
      status: 400,
      message: "Selecciona un archivo válido.",
    });
  });

  it("rejects unsupported MIME types with HTTP 415", async () => {
    const invalidFile = new File(["dummy content"], "archivo.exe", {
      type: "application/x-msdownload",
    });

    await expect(
      processClientDocumentUpload({
        clienteId: "cli_123",
        file: invalidFile,
        actorUserId: "usr_123",
      }),
    ).rejects.toMatchObject({
      name: "DocumentUploadServiceError",
      status: 415,
      message: "Solo se permiten PDF, JPG, PNG y WEBP.",
    });
  });

  it("rejects empty 0-byte files with HTTP 413", async () => {
    const emptyFile = new File([], "vacio.pdf", {
      type: "application/pdf",
    });

    await expect(
      processClientDocumentUpload({
        clienteId: "cli_123",
        file: emptyFile,
        actorUserId: "usr_123",
      }),
    ).rejects.toMatchObject({
      name: "DocumentUploadServiceError",
      status: 413,
    });
  });
});
