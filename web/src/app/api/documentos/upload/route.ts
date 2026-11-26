import { NextResponse } from "next/server";
import { logEvent } from "@/server/observability/log";

import { assertCanMutate, requireClienteAccess } from "@/server/auth/scope";
import {
  DocumentUploadServiceError,
  processClientDocumentUpload,
} from "@/server/drive/client-document-upload.service";

export const runtime = "nodejs";

/**
 * Compatibility route handler for cached client sessions that POST directly to /api/documentos/upload.
 * Accepts `clienteId` in FormData along with either `file` or `archivo`.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const clienteId = formData.get("clienteId");
    const file = formData.get("file") ?? formData.get("archivo");

    if (typeof clienteId !== "string" || !clienteId.trim()) {
      return NextResponse.json(
        { ok: false, error: "Falta el identificador del cliente (clienteId)." },
        { status: 400 },
      );
    }

    const trimmedClienteId = clienteId.trim();
    const { user } = await requireClienteAccess(trimmedClienteId);
    assertCanMutate(user);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Selecciona un archivo válido." },
        { status: 400 },
      );
    }

    const result = await processClientDocumentUpload({
      clienteId: trimmedClienteId,
      file,
      actorUserId: user.id,
    });

    return NextResponse.json({
      ok: true,
      documento: result.documento,
      carpetaUrl: result.carpetaUrl,
    });
  } catch (error) {
    if (error instanceof DocumentUploadServiceError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    logEvent("error", "documentos.carga_ruta_compatible_fallida", {}, error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo adjuntar el archivo.",
      },
      { status: 500 },
    );
  }
}

