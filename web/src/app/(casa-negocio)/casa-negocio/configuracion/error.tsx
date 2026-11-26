"use client";

import { ErrorTab } from "@/components/casa-negocio/ahorro/error-tab";

/**
 * Unexpected failure while reading the settings: the same sheet, message and
 * retry as the other tabs. The real error is logged on the server; the
 * browser only gets its digest.
 */
export default function ConfiguracionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorTab titulo="No se pudo cargar la configuración" reset={reset} />;
}
