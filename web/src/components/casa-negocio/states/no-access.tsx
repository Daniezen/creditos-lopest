import { cnHeaderRecipes, cnPaperRecipes, cnStateRecipes } from "@/design-system/recipes/casa-negocio";

import { ModuleState } from "./module-state";

/**
 * What a signed-in person without `casa_negocio.ver` gets: the module frame
 * with a plain message, and none of the family's figures. The eyebrow is the
 * page's h1 here (there is no month title). The layout renders
 * it instead of the tab; reads also refuse on their own (`requireCapacidad`).
 */
export function NoAccess() {
  return (
    <>
      <header className={cnHeaderRecipes.root}>
        <h1 className={cnHeaderRecipes.eyebrow}>Casa y Negocio</h1>
        <div className={cnStateRecipes.headerSpacer} />
      </header>
      <div className={cnPaperRecipes.sheet}>
        <ModuleState title="No tienes acceso a Casa y Negocio" text="Pide a quien administra el módulo que te dé permiso para verlo." />
      </div>
    </>
  );
}
