import { Fragment } from "react";
import Link from "next/link";

import { cnIdentityRecipes, cnTabRecipes } from "@/design-system/recipes/casa-negocio";

import { CASA_NEGOCIO_TAB_GROUPS, type CasaNegocioTab } from "./tabs";

const DOT = {
  casa: cnIdentityRecipes.dotCasa,
  negocio: `${cnIdentityRecipes.dotNegocio} ${cnTabRecipes.dotOnInk}`,
  ahorro: cnIdentityRecipes.dotAhorro,
} as const;

/**
 * Folder tabs (`ModuloTabs.dc.html`): the active tab is paper and joins the
 * sheet below it; groups are split by a thin separator; Casa, Negocio and
 * Ahorro wear their identity dot. Plain links with `aria-current="page"`.
 * `query` keeps the month being looked at when switching tabs.
 */
export function FolderTabs({ active, query }: { active: CasaNegocioTab; query?: string }) {
  return (
    <nav aria-label="Secciones" className={cnTabRecipes.nav}>
      <div className={cnTabRecipes.row}>
        {CASA_NEGOCIO_TAB_GROUPS.map((group, index) => (
          <Fragment key={group[0].id}>
            {index > 0 ? <span aria-hidden="true" className={cnTabRecipes.separator} /> : null}
            {group.map((tab) => (
              <Link
                key={tab.id}
                href={query ? `${tab.href}?${query}` : tab.href}
                aria-current={tab.id === active ? "page" : undefined}
                className={cnTabRecipes.tab}
              >
                {tab.identity ? <span aria-hidden="true" className={[cnTabRecipes.dot, DOT[tab.identity]].join(" ")} /> : null}
                {tab.label}
              </Link>
            ))}
          </Fragment>
        ))}
      </div>
    </nav>
  );
}
