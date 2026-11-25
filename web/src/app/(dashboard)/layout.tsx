import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/server/auth/guards";
import { resolveLoginProfileImage } from "@/server/auth/login-profile-image";
import { getPlatformVersion } from "@/server/versiones/versiones.service";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Authenticated dashboard boundary.
 *
 * Entity-level authorization remains in server queries, guards and actions.
 * Responsive navigation behavior is owned by DashboardShell so desktop,
 * drawer and mobile navigation cannot drift independently.
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const [user, version] = await Promise.all([requireUser(), getPlatformVersion()]);

  return (
    <DashboardShell
      version={version}
      user={{
        ...user,
        image: resolveLoginProfileImage(user.email, user.image),
      }}
    >
      {children}
    </DashboardShell>
  );
}
