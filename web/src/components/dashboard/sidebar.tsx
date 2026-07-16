"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, UserPlus } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";
import lopestLogo from "@/assets/lopest-logo.png";

import { LogoutButton } from "./logout-button";
import styles from "./sidebar.module.css";

/**
 * Sidebar principal del dashboard Lopest.
 *
 * Decisiones:
 * - El ancho vive en sidebar.module.css, no en globals.css.
 * - Vista normal desktop: 380px.
 * - Pantallas <= 1200px: 300px.
 * - Rutas densas: /reportes, /creditos/nuevo y /creditos/[id] usan 92px.
 * - La compactacion por baja altura queda encapsulada en CSS Module.
 */
export function DashboardSidebar() {
  const pathname = usePathname();

  const isCreditDetailRoute = /^\/creditos\/[^/]+$/.test(pathname);
  const isDenseRoute =
    pathname.startsWith("/reportes") ||
    pathname.startsWith("/creditos/nuevo") ||
    isCreditDetailRoute;

  return (
    <aside
      className={[
        styles.sidebar,
        isDenseRoute ? styles.sidebarDense : "",
        "hidden h-screen shrink-0 border-r border-violet-100 bg-white transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:flex-col",
      ].join(" ")}
    >
      <div
        className={[
          styles.brand,
          isDenseRoute ? styles.brandDense : "",
          "border-b border-violet-100",
        ].join(" ")}
      >
        <Link
          href="/creditos"
          className={[
            "flex items-center",
            isDenseRoute ? "justify-center" : "gap-3",
          ].join(" ")}
          title="Créditos Lopest"
        >
          <Image
            src={lopestLogo}
            alt="Logo de Créditos Lopest"
            width={256}
            height={256}
            priority
            className={[
              "shrink-0 object-contain drop-shadow-[0_10px_18px_rgba(124,58,237,0.20)]",
              isDenseRoute ? "h-11 w-11" : "h-[3.25rem] w-[3.25rem]",
            ].join(" ")}
          />

          {!isDenseRoute ? (
            <div>
              <p className="text-xl font-black tracking-tight text-violet-950">
                Créditos
              </p>
              <p className="text-base font-medium tracking-tight text-violet-700">
                Lopest
              </p>
            </div>
          ) : null}
        </Link>
      </div>

      {!isDenseRoute ? (
        <section
          className={[
            styles.createSection,
            "border-b border-violet-100",
          ].join(" ")}
        >
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Crear
          </p>

          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              href="/creditos/nuevo"
              label="Crédito"
              icon={CreditCard}
              active={pathname.startsWith("/creditos/nuevo")}
            />

            <QuickAction
              href="/clientes/nuevo"
              label="Cliente"
              icon={UserPlus}
              active={pathname.startsWith("/clientes/nuevo")}
            />
          </div>
        </section>
      ) : null}

      <nav
        className={[
          styles.nav,
          isDenseRoute ? styles.navDense : "",
          "min-h-0 flex-1 overflow-y-auto",
        ].join(" ")}
      >
        {!isDenseRoute ? (
          <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Navegación
          </p>
        ) : null}

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
                className={[
                  styles.navItem,
                  "group flex items-center rounded-2xl text-sm font-medium transition",
                  isDenseRoute ? styles.navItemDense : "gap-3 px-4",
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100"
                    : "text-violet-950 hover:bg-violet-50 hover:text-violet-700",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-5 w-5 shrink-0",
                    isActive
                      ? "text-white"
                      : "text-slate-500 group-hover:text-violet-700",
                  ].join(" ")}
                />

                {!isDenseRoute ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {!isDenseRoute ? (
        <div
          className={[styles.logout, "border-t border-violet-100"].join(" ")}
        >
          <LogoutButton />
        </div>
      ) : null}
    </aside>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}

function QuickAction({ href, label, icon: Icon, active }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={[
        styles.quickAction,
        "flex flex-col justify-between rounded-2xl border text-sm font-medium transition",
        active
          ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100"
          : "border-violet-100 bg-violet-50/70 text-violet-950 hover:border-violet-200 hover:bg-violet-100",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-5 w-5",
          active ? "text-white" : "text-violet-700",
        ].join(" ")}
      />
      <span>{label}</span>
    </Link>
  );
}
