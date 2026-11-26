import { CargandoTab } from "@/components/casa-negocio/ahorro/estado";
import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

/** While the month loads: the paper sheet with the tab's footprint. */
export default function AhorroLoading() {
  return (
    <div className={cnPaperRecipes.sheet}>
      <CargandoTab etiqueta="Cargando el ahorro…" forma="ahorro" />
    </div>
  );
}
