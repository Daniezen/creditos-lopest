"use client";

import { cnEstadoRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

/**
 * Error state of the Ahorro and Arqueo tabs (route `error.tsx`). The
 * server's message is not shown: in production it is replaced by a digest,
 * and it may carry internals. A retry re-renders the segment.
 */
export function ErrorTab({ titulo, reset }: { titulo: string; reset: () => void }) {
  return (
    <div className={cnPaperRecipes.sheet}>
      <section role="alert" className={cnEstadoRecipes.box}>
        <h2 className={cnEstadoRecipes.title}>{titulo}</h2>
        <p className={cnEstadoRecipes.text}>Algo falló al leer las cuentas. Tus datos no cambiaron.</p>
        <button type="button" onClick={reset} className={cnEstadoRecipes.action}>
          Intentar de nuevo
        </button>
      </section>
    </div>
  );
}
