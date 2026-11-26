import { ConfiguracionCargando } from "@/components/casa-negocio/configuracion/configuracion";
import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

/** While the settings load: the paper sheet with the sections' footprint. */
export default function ConfiguracionLoading() {
  return (
    <div className={cnPaperRecipes.sheet}>
      <ConfiguracionCargando />
    </div>
  );
}
