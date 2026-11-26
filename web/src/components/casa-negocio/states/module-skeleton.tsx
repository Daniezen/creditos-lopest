import { Fragment } from "react";

import { cnHeaderRecipes, cnPaperRecipes, cnSkeletonRecipes as k, cnTableroRecipes } from "@/design-system/recipes/casa-negocio";

import { CASA_NEGOCIO_TAB_GROUPS } from "../header/tabs";

/**
 * Loading frame of Casa y Negocio: the header's real boxes (eyebrow, title
 * row with its arrows, month line, folder tabs as plain labels) and the
 * Tablero's cards in their places, so the first paint of the month moves
 * nothing. Server component; announced once as busy, its parts are hidden
 * from assistive technology.
 *
 * The tabs are words, not links: a loading frame does not know the active
 * tab or the month, and a link here could drop `?mes=`.
 */
export function ModuleSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando el mes">
      <div aria-hidden="true" className={cnHeaderRecipes.root}>
        <div className={cnHeaderRecipes.eyebrow}>Casa y Negocio</div>
        <div className={k.titleRow}>
          <div className={k.title} />
          <div className={k.arrow} />
          <div className={k.arrow} />
        </div>
        <div className={k.line}>
          <div className={k.rail} />
        </div>
        <div className={k.tabs}>
          {CASA_NEGOCIO_TAB_GROUPS.map((group, index) => (
            <Fragment key={group[0].id}>
              {index > 0 ? <span className={k.separator} /> : null}
              {group.map((tab) => (
                <span key={tab.id} className={k.tab}>
                  {tab.label}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className={cnPaperRecipes.sheet}>
        <div className={cnTableroRecipes.row}>
          <div className={k.path} />
          <div className={k.calendar} />
        </div>
        <div className={k.equations} />
        <div className={cnTableroRecipes.row}>
          <div className={k.money} />
          <div className={k.street} />
        </div>
      </div>
    </div>
  );
}
