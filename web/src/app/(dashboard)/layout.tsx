import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { requireUser } from "@/server/auth/guards";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout privado del dashboard.
 *
 * Responsabilidades:
 * - exige autenticación antes de renderizar vistas internas;
 * - mantiene una sidebar fija en desktop;
 * - mantiene una topbar sticky sobre el área de contenido;
 * - agrega navegación inferior en pantallas pequeñas.
 *
 * Decisión visual:
 * - la sidebar usa h-screen + sticky para no depender del largo del contenido;
 * - el área central controla su propio scroll natural.
 *
 * Seguridad:
 * - este layout autentica usuario;
 * - no autoriza acceso a entidades concretas;
 * - los permisos por cliente/crédito deben vivir en queries, guards y actions.
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-[#f7f3ff] lg:flex">
      <DashboardSidebar />

      <div className="min-w-0 flex-1">
        <DashboardTopbar user={user} />

        <main className="min-w-0 pb-28 lg:pb-0">{children}</main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
