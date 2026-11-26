import { CargandoTab } from "@/components/casa-negocio/ahorro/estado";
import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";

/** While the balances load: the paper sheet with the cards' footprint. */
export default function ArqueoLoading() {
  return (
    <div className={cnPaperRecipes.sheet}>
      <CargandoTab etiqueta="Cargando las cuentas…" forma="arqueo" />
    </div>
  );
}
