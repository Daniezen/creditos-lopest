"use client";

import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";

/**
 * Error boundary of the tab: the header stays (it lives in the layout's
 * shell), only the sheet shows the failure and a retry. The real error is
 * logged on the server; the browser only gets its digest.
 */
export default function ConfiguracionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={r.notice} role="alert">
      <p>No se pudo cargar la configuración.</p>
      <button type="button" className={r.secondary} onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
