export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_DATA_STUDIO_EMBED_URL =
  "https://datastudio.google.com/embed/reporting/dd1f5e42-d77a-4a83-9af4-8487bde6756c/page/page_12345";

/**
 * Página de reportes embebida con Data Studio.
 *
 * Decisión:
 * - La URL puede venir desde DATA_STUDIO_REPORT_EMBED_URL.
 * - Si la variable no existe, se usa el reporte por defecto actual.
 * - Se valida host y path para evitar embeber URLs arbitrarias.
 */
function getDataStudioEmbedUrl(): string | null {
  const value =
    process.env.DATA_STUDIO_REPORT_EMBED_URL?.trim() ||
    DEFAULT_DATA_STUDIO_EMBED_URL;

  try {
    const url = new URL(value);

    const isAllowedHost =
      url.hostname === "datastudio.google.com" ||
      url.hostname === "lookerstudio.google.com";

    const isEmbedPath = url.pathname.startsWith("/embed/reporting/");

    if (!isAllowedHost || !isEmbedPath) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export default function ReportesPage() {
  const embedUrl = getDataStudioEmbedUrl();
  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">

      <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        {embedUrl ? (
          <iframe
            title="Panel de cartera Data Studio"
            src={embedUrl}
            className="min-h-[720px] w-full border-0"
            allowFullScreen
          />
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-950">
              El reporte no está configurado correctamente.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Revisa DATA_STUDIO_REPORT_EMBED_URL o la URL embebida por defecto.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
