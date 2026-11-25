import type { Metadata } from "next";

import { VersionTimeline } from "@/components/versiones/version-timeline";
import { requireUser } from "@/server/auth/guards";
import { getVersionTimeline } from "@/server/versiones/versiones.service";

export const metadata: Metadata = {
  title: "Novedades | Lopest Créditos",
};

/**
 * Novedades: what changed in each version, grouped by module.
 *
 * Open to every signed-in user; what each one reads is cut on the server by
 * `getVersionTimeline` (technical notes only for ADMIN).
 */
export default async function NovedadesPage() {
  const user = await requireUser();
  const { current, nodes } = await getVersionTimeline(user);

  return (
    <main className="mx-auto min-w-0 max-w-4xl px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-6">
        <h1 className="text-2xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
          Novedades
        </h1>
        <p className="mt-1 text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
          {current ? `Estás usando la versión ${current}. ` : ""}Aquí está lo que cambió en cada versión, por módulo.
        </p>
      </div>

      <VersionTimeline current={current} nodes={nodes} />
    </main>
  );
}
