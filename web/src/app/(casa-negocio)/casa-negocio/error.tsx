"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

import { ModuleState } from "@/components/casa-negocio/states/module-state";
import { cnHeaderRecipes, cnPaperRecipes, cnStateRecipes } from "@/design-system/recipes/casa-negocio";

/**
 * Failed load of a tab (the database did not answer, a migration is
 * missing, ...). The message stays generic on purpose: details go to the
 * server log, never to the screen. «Reintentar» asks the server for the
 * segment again (`router.refresh`) and then clears the boundary.
 */
export default function CasaNegocioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error("[casa-negocio] carga del mes", error.digest ?? error.message);
  }, [error]);

  return (
    <>
      <div className={cnHeaderRecipes.root}>
        <div className={cnHeaderRecipes.eyebrow}>Casa y Negocio</div>
        <div className={cnStateRecipes.headerSpacer} />
      </div>
      <div className={cnPaperRecipes.sheet}>
        <ModuleState role="alert" title="No se pudo cargar el mes" text="Puede ser una falla momentánea de la conexión.">
          <button type="button" onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            } className={cnStateRecipes.action}>
            Reintentar
          </button>
        </ModuleState>
      </div>
    </>
  );
}
