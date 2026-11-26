"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, UserPlus, X } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { navigationRecipes } from "@/design-system/recipes/navigation";
import { dashboardNavigation } from "@/config/navigation";
import lopestLogo from "@/assets/lopest-logo.png";

import { VersionFooterLink } from "@/components/versiones/version-footer-link";

import { LogoutButton } from "./logout-button";
import styles from "./sidebar.module.css";

interface DashboardSidebarProps {
  mode?: "desktop" | "drawer";
  /** Current platform version; the footer link opens Novedades. */
  version?: string | null;
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
  version = null,
  onNavigate,
  onClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        styles.sidebar,
        "h-screen shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]",
        mode === "desktop" ? "sticky top-0 flex flex-col" : "flex h-[100dvh] flex-col",
      ].join(" ")}
    >
      <div className={[styles.brand, "relative border-b border-[var(--color-border-subtle)]"].join(" ")}>
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
            <p className="truncate text-lg font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
              Lopest
            </p>
            <p className={`truncate ${dataDisplayRecipes.eyebrow}`}>
              Créditos
            </p>
          </div>
        </Link>

        {mode === "drawer" ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-selection)] hover:text-[var(--color-selection-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-soft)]"
            aria-label="Cerrar menú de navegación"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <section className={[styles.createSection, "border-b border-[var(--color-border-subtle)]"].join(" ")}>
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
                  navigationRecipes.item,
                  isActive
                    ? navigationRecipes.itemActive
                    : navigationRecipes.itemIdle,
                ].join(" ")}
              >
                <span
                  className={[
                    navigationRecipes.itemIcon,
                    isActive
                      ? navigationRecipes.itemIconActive
                      : navigationRecipes.itemIconIdle,
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

      <div className={[styles.logout, "border-t border-[var(--color-border-subtle)]"].join(" ")}>
        <LogoutButton />
        <div className={styles.version}>
          <VersionFooterLink version={version} onNavigate={onNavigate} />
        </div>
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
