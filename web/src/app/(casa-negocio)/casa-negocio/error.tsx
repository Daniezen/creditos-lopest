"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";

import { ModuleState } from "@/components/casa-negocio/states/module-state";
import { cnHeaderRecipes, cnPaperRecipes, cnStateRecipes } from "@/design-system/recipes/casa-negocio";

/**
 * Failed load of a tab (the database did not answer, a migration is
 * missing, ...). The message stays generic on purpose: Next.js already logs
 * the server error with its digest, and nothing technical reaches the screen
 * (the canvas has no explanatory text either). The frame keeps the module's
 * h1 so the page outline stays whole. «Reintentar» asks the server for the
 * segment again (`router.refresh`) and then clears the boundary.
 */
export default function CasaNegocioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  return (
    <>
      <header className={cnHeaderRecipes.root}>
        <h1 className={cnHeaderRecipes.eyebrow}>Casa y Negocio</h1>
        <div className={cnStateRecipes.headerSpacer} />
      </header>
      <div className={cnPaperRecipes.sheet}>
        <ModuleState role="alert" title="No se pudo cargar el mes">
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
            className={cnStateRecipes.action}
          >
            Reintentar
          </button>
        </ModuleState>
      </div>
    </>
  );
}
