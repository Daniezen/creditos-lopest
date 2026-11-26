import { cnShellRecipes, cnSkipLinkRecipes } from "@/design-system/recipes/casa-negocio";

import { ModuleBottomNav } from "./module-bottom-nav";
import { ModuleRail } from "./module-rail";
import { ModuleUserProvider } from "./module-user-context";
import type { ModuleUser } from "./user-avatar";

interface CasaNegocioShellProps {
  children: React.ReactNode;
  user: ModuleUser;
  version: string | null;
}

/**
 * Frame of the Casa y Negocio module (`Main.dc.html`): lienzo ground, dark
 * folded rail on the left from 768 px, dark bottom bar below it, and no
 * topbar. Landmarks: the rail (`nav`, from 768 px), `main`, the bottom bar
 * (`nav`, below 768 px; only one of the two navigations is ever displayed),
 * and a skip link to `main` as the first Tab stop. Server component; only
 * the two navigations are client islands.
 */
export function CasaNegocioShell({ children, user, version }: CasaNegocioShellProps) {
  return (
    <div className={cnShellRecipes.root}>
      {/* First Tab stop: past the rail's seven destinations straight to the month. */}
      <a href="#cn-contenido" className={cnSkipLinkRecipes.link}>
        Saltar al contenido
      </a>
      <ModuleRail user={user} version={version} />
      <main id="cn-contenido" tabIndex={-1} className={cnShellRecipes.main}>
        <div className={cnShellRecipes.column}>
          <ModuleUserProvider user={user}>{children}</ModuleUserProvider>
        </div>
      </main>
      <ModuleBottomNav version={version} />
    </div>
  );
}
