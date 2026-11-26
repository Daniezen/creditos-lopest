"use client";

import { ErrorTab } from "@/components/casa-negocio/ahorro/error-tab";

/** Unexpected failure while reading the month: say it and offer a retry. */
export default function AhorroError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorTab titulo="No se pudo cargar el ahorro" reset={reset} />;
}
