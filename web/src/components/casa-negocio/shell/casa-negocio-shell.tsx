import { cnShellRecipes } from "@/design-system/recipes/casa-negocio";

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
 * topbar. Server component; only the two navigations are client islands.
 */
export function CasaNegocioShell({ children, user, version }: CasaNegocioShellProps) {
  return (
    <div className={cnShellRecipes.root}>
      <ModuleRail user={user} version={version} />
      <main className={cnShellRecipes.main}>
        <div className={cnShellRecipes.column}>
          <ModuleUserProvider user={user}>{children}</ModuleUserProvider>
        </div>
      </main>
      <ModuleBottomNav version={version} />
    </div>
  );
}
