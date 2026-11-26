import { cnHeaderRecipes, cnPaperRecipes, cnStateRecipes } from "@/design-system/recipes/casa-negocio";

import { ModuleState } from "./module-state";

/**
 * What a signed-in person without `casa_negocio.ver` gets: the module frame
 * with a plain message, and none of the family's figures. The layout renders
 * it instead of the tab; reads also refuse on their own (`requireCapacidad`).
 */
export function NoAccess() {
  return (
    <>
      <header className={cnHeaderRecipes.root}>
        <div className={cnHeaderRecipes.eyebrow}>Casa y Negocio</div>
        <div className={cnStateRecipes.headerSpacer} />
      </header>
      <div className={cnPaperRecipes.sheet}>
        <ModuleState title="No tienes acceso a Casa y Negocio" text="Pide a quien administra el módulo que te dé permiso para verlo." />
      </div>
    </>
  );
}
