import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/server/auth/guards";

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

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
