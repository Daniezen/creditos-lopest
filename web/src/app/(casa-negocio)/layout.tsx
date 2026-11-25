import { CasaNegocioShell } from "@/components/casa-negocio/shell/casa-negocio-shell";
import { requireUser } from "@/server/auth/guards";
import { resolveLoginProfileImage } from "@/server/auth/login-profile-image";
import { getPlatformVersion } from "@/server/versiones/versiones.service";

/**
 * Authenticated boundary of Casa y Negocio, a route group of its own so the
 * app's DashboardShell (white sidebar + topbar) does not wrap it and this
 * module's rail does not wrap anything else.
 *
 * Authentication works exactly as in (dashboard): `requireUser()` here, the
 * proxy cookie gate before it. The per-capability check (`casa_negocio.ver`,
 * spec §2) belongs to the data layer being built in parallel and goes in this
 * layout as soon as it exists; mutations will validate their own capability
 * on the server.
 */
export default async function CasaNegocioLayout({ children }: { children: React.ReactNode }) {
  const [user, version] = await Promise.all([requireUser(), getPlatformVersion()]);

  return (
    <CasaNegocioShell
      version={version}
      user={{
        nombre: user.nombre,
        roleNames: user.roleNames,
        image: resolveLoginProfileImage(user.email, user.image),
      }}
    >
      {children}
    </CasaNegocioShell>
  );
}
