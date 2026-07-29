"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, UserPlus, X } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";
import lopestLogo from "@/assets/lopest-logo.png";

import { LogoutButton } from "./logout-button";
import styles from "./sidebar.module.css";

interface DashboardSidebarProps {
  mode?: "desktop" | "drawer";
  onNavigate?: () => void;
  onClose?: () => void;
}

/** Full dashboard navigation used from 1200 px and inside the tablet drawer. */
export function DashboardSidebar({
  mode = "desktop",
  onNavigate,
  onClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        styles.sidebar,
        "h-screen shrink-0 border-r border-violet-100 bg-white transition-[width] duration-200",
        mode === "desktop" ? "sticky top-0 flex flex-col" : "flex h-[100dvh] flex-col",
      ].join(" ")}
    >
      <div className={[styles.brand, "relative border-b border-violet-100"].join(" ")}>
        <Link href="/creditos" className="flex items-center gap-3 pr-10" title="Créditos Lopest" onClick={onNavigate}>
          <Image
            src={lopestLogo}
            alt="Logo de Créditos Lopest"
            width={256}
            height={256}
            priority
            className="h-[3.25rem] w-[3.25rem] shrink-0 object-contain drop-shadow-[0_10px_18px_rgba(124,58,237,0.20)]"
          />
          <div>
            <p className="text-xl font-black tracking-tight text-violet-950">Créditos</p>
            <p className="text-base font-medium tracking-tight text-violet-700">Lopest</p>
          </div>
        </Link>

        {mode === "drawer" ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-violet-100 bg-white text-violet-700 shadow-sm transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
            aria-label="Cerrar menú de navegación"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <section className={[styles.createSection, "border-b border-violet-100"].join(" ")}>
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Crear</p>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction href="/creditos/nuevo" label="Crédito" icon={CreditCard} active={pathname.startsWith("/creditos/nuevo")} onNavigate={onNavigate} />
          <QuickAction href="/clientes/nuevo" label="Cliente" icon={UserPlus} active={pathname.startsWith("/clientes/nuevo")} onNavigate={onNavigate} />
        </div>
      </section>

      <nav className={[styles.nav, "min-h-0 flex-1 overflow-y-auto"].join(" ")} aria-label="Navegación principal">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Navegación</p>
        <div className={styles.navList}>
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={[
                  styles.navItem,
                  "group flex items-center gap-3 rounded-2xl px-4 text-sm font-medium transition",
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100"
                    : "text-violet-950 hover:bg-violet-50 hover:text-violet-700",
                ].join(" ")}
              >
                <Icon className={["h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-violet-700"].join(" ")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={[styles.logout, "border-t border-violet-100"].join(" ")}>
        <LogoutButton />
      </div>
    </aside>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
}

function QuickAction({ href, label, icon: Icon, active, onNavigate }: QuickActionProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        styles.quickAction,
        "flex flex-col justify-between rounded-2xl border text-sm font-medium transition",
        active
          ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100"
          : "border-violet-100 bg-violet-50/70 text-violet-950 hover:border-violet-200 hover:bg-violet-100",
      ].join(" ")}
    >
      <Icon className={["h-5 w-5", active ? "text-white" : "text-violet-700"].join(" ")} />
      <span>{label}</span>
    </Link>
  );
}
