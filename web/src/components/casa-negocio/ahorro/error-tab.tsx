"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";

import { cnEstadoRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

/**
 * Error state of the Ahorro, Arqueo, Resumen and Configuración tabs (route
 * `error.tsx`). The server's message is not shown: in production it is
 * replaced by a digest, and it may carry internals. A retry asks the server
 * for the segment again (`router.refresh`) and clears the boundary; `reset`
 * alone would only re-render the client part and show the same failure.
 */
export function ErrorTab({ titulo, reset }: { titulo: string; reset: () => void }) {
  const router = useRouter();
  const reintentar = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div className={cnPaperRecipes.sheet}>
      <section role="alert" className={cnEstadoRecipes.box}>
        <h2 className={cnEstadoRecipes.title}>{titulo}</h2>
        <p className={cnEstadoRecipes.text}>Algo falló al leer los datos. Nada cambió.</p>
        <button type="button" onClick={reintentar} className={cnEstadoRecipes.action}>
          Intentar de nuevo
        </button>
      </section>
    </div>
  );
}
