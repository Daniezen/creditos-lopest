"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, UserPlus, X } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dashboardNavigation } from "@/config/navigation";
import lopestLogo from "@/assets/lopest-logo.png";

import { LogoutButton } from "./logout-button";
import styles from "./sidebar.module.css";

interface DashboardSidebarProps {
  mode?: "desktop" | "drawer";
  onNavigate?: () => void;
  onClose?: () => void;
}

/**
 * Stable navigation surface shared by desktop and the tablet drawer.
 *
 * Visual contract:
 * - Lopest is the primary brand name; Créditos is its descriptor.
 * - Color remains part of the identity, but active and hover states use restrained
 *   surfaces instead of gradients and colored shadows.
 * - Creation actions are compact, button-like quick actions backed by the design contract.
 */
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
        "h-screen shrink-0 border-r border-slate-200 bg-white",
        mode === "desktop" ? "sticky top-0 flex flex-col" : "flex h-[100dvh] flex-col",
      ].join(" ")}
    >
      <div className={[styles.brand, "relative border-b border-slate-200"].join(" ")}>
        <Link
          href="/creditos"
          className="flex min-w-0 items-center gap-3 pr-10"
          title="Lopest Créditos"
          onClick={onNavigate}
        >
          <Image
            src={lopestLogo}
            alt="Logo de Lopest"
            width={256}
            height={256}
            priority
            className="h-11 w-11 shrink-0 object-contain"
          />

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight text-slate-950">
              Lopest
            </p>
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-violet-700">
              Créditos
            </p>
          </div>
        </Link>

        {mode === "drawer" ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
            aria-label="Cerrar menú de navegación"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <section className={[styles.createSection, "border-b border-slate-200"].join(" ")}>
        <p className={styles.sectionLabel}>Crear</p>
        <div className={styles.quickActionGrid}>
          <QuickAction
            href="/creditos/nuevo"
            label="Nuevo crédito"
            icon={CreditCard}
            variant="primary"
            active={pathname.startsWith("/creditos/nuevo")}
            onNavigate={onNavigate}
          />
          <QuickAction
            href="/clientes/nuevo"
            label="Nuevo cliente"
            icon={UserPlus}
            variant="secondary"
            active={pathname.startsWith("/clientes/nuevo")}
            onNavigate={onNavigate}
          />
        </div>
      </section>

      <nav
        className={[styles.nav, "min-h-0 flex-1 overflow-y-auto"].join(" ")}
        aria-label="Navegación principal"
      >
        <p className={styles.sectionLabel}>Navegación</p>
        <div className={styles.navList}>
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
                className={[
                  styles.navItem,
                  "group flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                  isActive
                    ? "bg-violet-100/75 text-violet-950"
                    : "text-slate-700 hover:bg-violet-50/80 hover:text-violet-900",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                    isActive
                      ? "bg-white/80 text-violet-700"
                      : "text-slate-500 group-hover:text-violet-700",
                  ].join(" ")}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem]" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={[styles.logout, "border-t border-slate-200"].join(" ")}>
        <LogoutButton />
      </div>
    </aside>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  variant: "primary" | "secondary";
  active: boolean;
  onNavigate?: () => void;
}

function QuickAction({
  href,
  label,
  icon: Icon,
  variant,
  active,
  onNavigate,
}: QuickActionProps) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        styles.quickAction,
        isPrimary
          ? actionRecipes.quickActionPrimary
          : actionRecipes.quickActionSecondary,
        active ? styles.quickActionActive : "",
      ].join(" ")}
    >
      <span
        className={
          isPrimary
            ? actionRecipes.quickActionIconPrimary
            : actionRecipes.quickActionIconSecondary
        }
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <span className={styles.quickActionLabel}>{label}</span>
    </Link>
  );
}
