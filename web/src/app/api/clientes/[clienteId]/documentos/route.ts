import { NextResponse } from "next/server";

import { assertCanMutate, requireClienteAccess } from "@/server/auth/scope";
import {
  DocumentUploadServiceError,
  processClientDocumentUpload,
} from "@/server/drive/client-document-upload.service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ clienteId: string }>;
}

/**
 * Uploads exactly one client document per request (Canonical REST route).
 * Path: POST /api/clientes/[clienteId]/documentos
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { clienteId } = await context.params;
    const { user } = await requireClienteAccess(clienteId);
    assertCanMutate(user);

    const formData = await request.formData();
    const file = formData.get("file") ?? formData.get("archivo");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Selecciona un archivo válido." },
        { status: 400 },
      );
    }

    const result = await processClientDocumentUpload({
      clienteId,
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

    console.error("Canonical client document upload route failed", { error });
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
