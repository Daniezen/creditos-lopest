import { CargandoTab } from "@/components/casa-negocio/ahorro/estado";
import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

/** While the months load: the paper sheet with the charts' footprint. */
export default function ResumenLoading() {
  return (
    <div className={cnPaperRecipes.sheet}>
      <CargandoTab etiqueta="Cargando el resumen…" forma="ahorro" />
    </div>
  );
}
