import { CasaNegocioShell } from "@/components/casa-negocio/shell/casa-negocio-shell";
import { NoAccess } from "@/components/casa-negocio/states/no-access";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guards";
import { resolveLoginProfileImage } from "@/server/auth/login-profile-image";
import { capacidadesDe } from "@/server/casa-negocio/capacidades";
import { getPlatformVersion } from "@/server/versiones/versiones.service";

/**
 * Authenticated boundary of Casa y Negocio, a route group of its own so the
 * app's DashboardShell (white sidebar + topbar) does not wrap it and this
 * module's rail does not wrap anything else.
 *
 * AUTHORIZATION. `requireUser()` authenticates (the proxy cookie gate runs
 * before it). Then the module capability `casa_negocio.ver` (spec §2, stored
 * in `cn_permisos`) decides whether the tabs render at all: without it the
 * person gets the frame and a «no access» message, and none of the pages —
 * and so none of their reads — run. Each read and each mutation still checks
 * its own capability on the server (`requireCapacidad`), so this gate is not
 * the only guard.
 *
 * THE HEADER is not built here: layouts receive no `searchParams` and do not
 * re-render when only `?mes=` changes. Every tab builds it with
 * `encabezadoModulo` from `@/server/casa-negocio/pagina` (see its comment).
 */
export default async function CasaNegocioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [version, capacidades] = await Promise.all([getPlatformVersion(), capacidadesDe(prisma, user.id)]);

  return (
    <CasaNegocioShell
      version={version}
      user={{
        nombre: user.nombre,
        roleNames: user.roleNames,
        image: resolveLoginProfileImage(user.email, user.image),
      }}
    >
      {capacidades.has("VER") ? children : <NoAccess />}
    </CasaNegocioShell>
  );
}
