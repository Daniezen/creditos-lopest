"use client";

import { ErrorPestana } from "@/components/casa-negocio/casa/error-pestana";

export default function ErrorCasa({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPestana etiqueta="la casa" reset={reset} />;
}
