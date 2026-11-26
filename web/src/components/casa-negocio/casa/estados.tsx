import { cnPaperRecipes } from "@/design-system/recipes/casa-negocio";
import { cnCardRecipes, cnSkeletonRecipes } from "@/design-system/recipes/casa-negocio-libros";

/**
 * Whole-tab states of Casa and Negocio that cannot draw the header (it needs
 * the month's data): no access, and the loading skeleton.
 */
export function SinAcceso({ mensaje }: { mensaje: string }) {
  return (
    <div className={cnPaperRecipes.sheet}>
      <p role="status" className={cnCardRecipes.empty}>
        {mensaje}
      </p>
    </div>
  );
}

/** Same footprint as the tab: strip, form, book. */
export function CargandoPestana({ etiqueta }: { etiqueta: string }) {
  return (
    <div className={cnPaperRecipes.sheet} aria-busy="true">
      <span role="status" className="sr-only">
        Cargando {etiqueta}…
      </span>
      <div aria-hidden="true" className={`${cnSkeletonRecipes.block} ${cnSkeletonRecipes.strip}`} />
      <div aria-hidden="true" className={`${cnSkeletonRecipes.block} ${cnSkeletonRecipes.form}`} />
      <div aria-hidden="true" className={`${cnSkeletonRecipes.block} ${cnSkeletonRecipes.book}`} />
    </div>
  );
}
