"use client";

import { ErrorPestana } from "@/components/casa-negocio/casa/error-pestana";

export default function ErrorNegocio({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPestana etiqueta="el negocio" reset={reset} />;
}
