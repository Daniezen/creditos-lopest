"use client";

import { useEffect, useState } from "react";

import { DashboardTopbar } from "./dashboard-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { DashboardSidebar } from "./sidebar";
import styles from "./dashboard-shell.module.css";

interface DashboardShellUser {
  nombre: string;
  email: string;
  roles: string[];
}

interface DashboardShellProps {
  children: React.ReactNode;
  user: DashboardShellUser;
}

/**
 * Coordinates the three approved navigation modes:
 * - full sidebar from 1200 px;
 * - overlay drawer between 768 and 1199 px;
 * - bottom navigation below 768 px.
 */
export function DashboardShell({ children, user }: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-[#f7f3ff] min-[1200px]:flex">
      <div className={styles.desktopSidebar}>
        <DashboardSidebar />
      </div>

      <div className="min-w-0 flex-1">
        <DashboardTopbar
          user={user}
          drawerOpen={drawerOpen}
          onMenuClick={() => setDrawerOpen((current) => !current)}
        />
        <main className="min-w-0 pb-28 md:pb-0">{children}</main>
      </div>

      <MobileBottomNav />

      {drawerOpen ? (
        <div className={styles.drawerLayer}>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Cerrar menú de navegación"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="dashboard-navigation-drawer"
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <DashboardSidebar
              mode="drawer"
              onNavigate={() => setDrawerOpen(false)}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
