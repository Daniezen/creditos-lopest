"use client";

import { ErrorTab } from "@/components/casa-negocio/ahorro/error-tab";

/** Unexpected failure while reading the balances: say it and offer a retry. */
export default function ArqueoError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorTab titulo="No se pudo cargar el arqueo" reset={reset} />;
}
