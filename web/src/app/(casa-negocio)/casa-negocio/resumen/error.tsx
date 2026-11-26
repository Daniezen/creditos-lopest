"use client";

import { ErrorTab } from "@/components/casa-negocio/ahorro/error-tab";

/** Unexpected failure while reading the months: say it and offer a retry. */
export default function ResumenError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorTab titulo="No se pudo cargar el resumen" reset={reset} />;
}
