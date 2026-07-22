"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, LoaderCircle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface ClientDocument {
  id: string;
  nombreArchivo: string;
  mimeType: string | null;
  tamanoBytes: number | null;
  url: string;
  creadoEn: Date;
}

interface ClientDocumentsPanelProps {
  clienteId: string;
  clienteNombre: string;
  clienteCedula: string;
  carpetaUrl: string | null;
  documentos: ClientDocument[];
  canUpload: boolean;
  maxFiles: number;
  maxBytes: number;
}

interface QueueItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

/** Client document inventory and multi-file upload modal. */
export function ClientDocumentsPanel(props: ClientDocumentsPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  function selectFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, props.maxFiles);
    setQueue(
      selected.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: "pending",
      })),
    );
  }

  async function uploadAll() {
    if (queue.length === 0 || uploading) return;
    setUploading(true);

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);

    try {
      const work = [...queue];
      let cursor = 0;

      async function worker() {
        while (cursor < work.length) {
          const index = cursor++;
          const item = work[index];

          if (item.file.size > props.maxBytes) {
            updateStatus(item.id, "error", "Supera el tamaño permitido.");
            continue;
          }

          updateStatus(item.id, "uploading");
          const formData = new FormData();
          formData.set("file", item.file);

          try {
            const response = await fetch(
              `/api/clientes/${props.clienteId}/documentos`,
              { method: "POST", body: formData },
            );
            const result = (await response.json()) as {
              ok: boolean;
              error?: string;
            };

            if (!response.ok || !result.ok) {
              throw new Error(result.error || "No se pudo subir el archivo.");
            }

            updateStatus(item.id, "success");
          } catch (error) {
            updateStatus(
              item.id,
              "error",
              error instanceof Error ? error.message : "Error desconocido.",
            );
          }
        }
      }

      await Promise.all([worker(), worker()]);
      router.refresh();
    } finally {
      window.removeEventListener("beforeunload", beforeUnload);
      setUploading(false);
    }
  }

  function updateStatus(
    id: string,
    status: QueueItem["status"],
    error?: string,
  ) {
    setQueue((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status, error } : item,
      ),
    );
  }

  return (
    <section className="mt-5 border-t border-violet-100 pt-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 className="font-semibold text-slate-950">Documentos del cliente</h4>
          <p className="mt-1 text-sm text-slate-500">
            {props.documentos.length > 0
              ? `${props.documentos.length} archivo(s) inventariado(s) en Lopest.`
              : props.carpetaUrl
                ? "Carpeta histórica vinculada; archivos anteriores aún no inventariados."
                : "Sin archivos registrados."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.canUpload ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              <Upload className="h-4 w-4" />
              Adjuntar
            </button>
          ) : null}
          {props.carpetaUrl ? (
            <a
              href={props.carpetaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir carpeta
            </a>
          ) : null}
        </div>
      </div>

      {props.documentos.length > 0 ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {props.documentos.map((documento) => (
            <a
              key={documento.id}
              href={documento.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-violet-100 bg-[#fbfaff] p-3 hover:bg-violet-50"
            >
              <FileText className="h-5 w-5 shrink-0 text-violet-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-950">
                  {documento.nombreArchivo}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatFileSize(documento.tamanoBytes)}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
            </a>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Adjuntar documentos
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {props.clienteNombre} · C.C. {props.clienteCedula}
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="mt-5 flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 text-center hover:bg-violet-50 disabled:opacity-50"
            >
              <Upload className="h-7 w-7 text-violet-600" />
              <span className="mt-2 text-sm font-medium text-slate-950">
                Seleccionar archivos
              </span>
              <span className="mt-1 text-xs text-slate-500">
                PDF, JPG, PNG o WEBP · máximo {formatFileSize(props.maxBytes)}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => selectFiles(event.target.files)}
            />

            {queue.length > 0 ? (
              <div className="mt-4 space-y-2">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-slate-800">
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {item.status === "uploading" ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : item.status === "success" ? (
                          "Cargado"
                        ) : item.status === "error" ? (
                          "Error"
                        ) : (
                          formatFileSize(item.file.size)
                        )}
                      </span>
                    </div>
                    {item.error ? (
                      <p className="mt-1 text-xs text-red-700">{item.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={queue.length === 0 || uploading}
                onClick={uploadAll}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-slate-300"
              >
                {uploading ? "Subiendo..." : "Subir archivos"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "Tamaño no registrado";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
