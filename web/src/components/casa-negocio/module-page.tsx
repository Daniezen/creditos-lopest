import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

import { ModuleHeader, type ModuleHeaderProps } from "./header/module-header";

/**
 * One tab of Casa y Negocio: the common header, then the warm paper sheet
 * joined to the active folder tab. Pages pass the header's data and put their
 * content inside; an empty sheet keeps its footprint.
 */
export function ModulePage({ header, children }: { header: ModuleHeaderProps; children?: React.ReactNode }) {
  return (
    <>
      <ModuleHeader {...header} />
      <div className={cnPaperRecipes.sheet}>{children ?? <div className={cnPaperRecipes.empty} />}</div>
    </>
  );
}
