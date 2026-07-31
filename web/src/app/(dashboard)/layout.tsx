import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/server/auth/guards";

function resolveLoginProfileImage(
  email: string,
  fallback: string | null,
): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  const profiles = [
    {
      email: process.env.LOGIN_PROFILE_DANIEL_EMAIL,
      image: process.env.LOGIN_PROFILE_DANIEL_IMAGE || "/login/daniel.jpg",
    },
    {
      email: process.env.LOGIN_PROFILE_PADRE_EMAIL,
      image: process.env.LOGIN_PROFILE_PADRE_IMAGE || "/login/padre.jpg",
    },
    {
      email: process.env.LOGIN_PROFILE_MADRE_EMAIL,
      image: process.env.LOGIN_PROFILE_MADRE_IMAGE || "/login/madre.jpg",
    },
  ];

  const profile = profiles.find(
    (item) => item.email?.trim().toLowerCase() === normalizedEmail,
  );

  return profile?.image ?? fallback;
}

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
  const user = await requireUser();

  return (
    <DashboardShell
      user={{
        ...user,
        image: resolveLoginProfileImage(user.email, user.image),
      }}
    >
      {children}
    </DashboardShell>
  );
}
