import { cnHeaderRecipes, cnPaperRecipes, cnStateRecipes, cnTableroRecipes } from "@/design-system/recipes/casa-negocio";

/**
 * Loading state of every tab: the header and sheet footprint with quiet
 * placeholder blocks, so nothing jumps when the month arrives. Announced
 * once as busy; the placeholders themselves are hidden from assistive tech.
 */
export default function CasaNegocioLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando el mes">
      <div className={cnHeaderRecipes.root}>
        <div aria-hidden="true" className={cnHeaderRecipes.eyebrow}>
          Casa y Negocio
        </div>
        <div aria-hidden="true" className={`${cnStateRecipes.bone} ${cnStateRecipes.boneTitle}`} />
        <div aria-hidden="true" className={`${cnStateRecipes.bone} ${cnStateRecipes.boneLine}`} />
      </div>
      <div aria-hidden="true" className={cnPaperRecipes.sheet}>
        <div className={cnTableroRecipes.row}>
          <div className={cnStateRecipes.boneCard} />
          <div className={cnStateRecipes.boneCard} />
        </div>
        <div className={cnStateRecipes.boneCard} />
      </div>
    </div>
  );
}
