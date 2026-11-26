"use client";

import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";
import { cnCardRecipes, cnFormRecipes } from "@/design-system/recipes/casa-negocio-libros";

/** Error boundary content of the Casa and Negocio tabs: says it failed and offers a retry. */
export function ErrorPestana({ etiqueta, reset }: { etiqueta: string; reset: () => void }) {
  return (
    <div className={cnPaperRecipes.sheet}>
      <div role="alert" className={`${cnCardRecipes.empty} flex flex-col items-center gap-4`}>
        <p>No se pudo cargar {etiqueta}.</p>
        <button type="button" className={cnFormRecipes.secondary} onClick={reset}>
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
