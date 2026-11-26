"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, LoaderCircle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { actionRecipes } from "@/design-system/recipes/actions";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";

interface DocumentoItem {
  id: string;
  nombreArchivo: string;
  url: string;
  tamanoBytes: number | null;
  driveDisponible: boolean;
}

interface ClientDocumentsPanelProps {
  clienteId: string;
  clienteNombre: string;
  clienteCedula: string;
  carpetaUrl: string | null;
  documentos: DocumentoItem[];
  canUpload: boolean;
  maxFiles?: number;
  maxBytes: number;
}

interface QueueItem {
  id: string;
  file: File;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
}

export function ClientDocumentsPanel(props: ClientDocumentsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: QueueItem[] = [];
    for (const file of Array.from(files)) {
      if (file.size > props.maxBytes) {
        next.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          status: "error",
          error: `Excede el tamaño máximo permitido (${formatFileSize(props.maxBytes)}).`,
        });
      } else {
        next.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          status: "idle",
        });
      }
    }
    setQueue((current) => [...current, ...next]);
  }

  async function uploadAll() {
    const pendings = queue.filter((item) => item.status === "idle");
    if (pendings.length === 0) return;

    setUploading(true);
    setSummary(null);

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);

    try {
      let index = 0;
      const finalStatuses = new Map<string, "success" | "error">();

      async function worker() {
        while (index < pendings.length) {
          const current = pendings[index++];
          if (!current) break;

          updateStatus(current.id, "uploading");
          const form = new FormData();
          form.set("file", current.file);

          try {
            const response = await fetch(
              `/api/clientes/${props.clienteId}/documentos`,
              {
                method: "POST",
                body: form,
              },
            );

            const body = (await response.json().catch(() => null)) as
              | { ok?: boolean; error?: string }
              | null;

            if (!response.ok || !body?.ok) {
              const errorMessage =
                body?.error ||
                (response.status === 413
                  ? "El archivo excede el tamaño máximo permitido."
                  : response.status === 415
                    ? "Formato de archivo no permitido."
                    : `Error en el servidor (${response.status}).`);
              throw new Error(errorMessage);
            }

            updateStatus(current.id, "success");
            finalStatuses.set(current.id, "success");
          } catch (error) {
            console.error("Fallo al adjuntar documento", {
              clienteId: props.clienteId,
              fileName: current.file.name,
              error,
            });
            finalStatuses.set(current.id, "error");
            updateStatus(
              current.id,
              "error",
              error instanceof Error ? error.message : "Error desconocido.",
            );
          }
        }
      }

      await Promise.all([worker(), worker()]);
      const successful = [...finalStatuses.values()].filter(
        (status) => status === "success",
      ).length;
      const failed = [...finalStatuses.values()].filter(
        (status) => status === "error",
      ).length;
      setSummary(
        failed === 0
          ? `${successful} archivo(s) subido(s) correctamente.`
          : `${successful} archivo(s) subido(s), ${failed} con error.`,
      );
    } finally {
      window.removeEventListener("beforeunload", beforeUnload);
      setUploading(false);
    }
  }

  function updateStatus(id: string, status: QueueItem["status"], error?: string) {
    setQueue((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status, error } : item,
      ),
    );
  }

  function closeModal() {
    if (uploading) return;
    setOpen(false);
    setQueue([]);
    setSummary(null);
    router.refresh();
  }

  function uploadMore() {
    setQueue([]);
    setSummary(null);
    inputRef.current?.click();
  }

  return (
    <section className="mt-5 border-t border-[var(--color-border-subtle)] pt-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 className="font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">Documentos del cliente</h4>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {props.documentos.length === 1
              ? "1 archivo en Drive."
              : `${props.documentos.length} archivos en Drive.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.canUpload ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={actionRecipes.primary}
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
              className={actionRecipes.secondary}
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
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 transition hover:bg-[var(--color-selection)]"
            >
              <FileText className="h-5 w-5 shrink-0 text-[var(--color-selection-strong)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-[var(--font-weight-data-emphasis)] text-[var(--color-text-primary)]">
                  {documento.nombreArchivo}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  {formatFileSize(documento.tamanoBytes)}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            </a>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className={surfaceRecipes.modalBackdrop}>
          <div className={`max-h-[90vh] w-full max-w-xl overflow-y-auto ${surfaceRecipes.overlay} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
                  Adjuntar documentos
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {props.clienteNombre} · C.C. {props.clienteCedula}
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={closeModal}
                className="rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-selection)] disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="mt-5 flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] p-6 text-center transition hover:bg-[var(--color-selection)] disabled:opacity-50"
            >
              <Upload className="h-7 w-7 text-[var(--color-selection-strong)]" />
              <span className="mt-2 text-sm font-[var(--font-weight-action)] text-[var(--color-text-primary)]">
                Seleccionar archivos
              </span>
              <span className="mt-1 text-xs text-[var(--color-text-secondary)]">
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
                  <div key={item.id} className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-[var(--color-text-primary)]">
                        {item.file.name}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
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
                      <p className="mt-1 text-xs text-[var(--color-danger)]">{item.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {summary ? (
              <div className={`mt-4 ${surfaceRecipes.alertSuccess}`}>
                {summary}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {summary ? (
                <button
                  type="button"
                  onClick={uploadMore}
                  className={actionRecipes.secondary}
                >
                  Subir más archivos
                </button>
              ) : null}
              <button
                type="button"
                disabled={uploading}
                onClick={closeModal}
                className={actionRecipes.secondary}
              >
                Cerrar
              </button>
              {!summary ? (
                <button
                  type="button"
                  disabled={queue.length === 0 || uploading}
                  onClick={uploadAll}
                  className={actionRecipes.primary}
                >
                  {uploading ? "Subiendo..." : "Subir archivos"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "Tamano no registrado";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
