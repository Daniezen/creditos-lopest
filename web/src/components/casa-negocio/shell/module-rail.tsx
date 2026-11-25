"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { NOVEDADES_HREF } from "@/components/versiones/version-footer-link";
import { cnShellRecipes } from "@/design-system/recipes/casa-negocio";

import { Glyph } from "../shared/glyph";
import { buildRailItems, isRailItemActive, SIGN_OUT_GLYPH } from "./rail-items";
import { UserAvatar, type ModuleUser } from "./user-avatar";

interface ModuleRailProps {
  user: ModuleUser;
  /** Current platform version; null hides it. */
  version: string | null;
}

/**
 * Dark folded rail of Casa y Negocio (`Sidebar.dc.html`), from 768 px up.
 * Icon with its name under it, active item on a violet icon well, avatar and
 * version at the foot. Only this module's layout renders it; the rest of the
 * app keeps its current sidebar.
 *
 * One addition to the artboard: «Salir» above the avatar, because the module
 * has no topbar and the session must be closable from here.
 */
export function ModuleRail({ user, version }: ModuleRailProps) {
  const pathname = usePathname();
  const [signingOut, startSignOut] = useTransition();
  const items = buildRailItems();

  return (
    <nav aria-label="Navegación principal" className={cnShellRecipes.rail}>
      <Link href="/" aria-label="Lopest, inicio" className={cnShellRecipes.railBrand}>
        L
      </Link>

      {items.map((item) => {
        const active = isRailItemActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.shortLabel === item.label ? undefined : item.label}
            className={cnShellRecipes.railItem}
          >
            <span className={[cnShellRecipes.railIcon, active ? cnShellRecipes.railIconActive : ""].join(" ")}>
              <Glyph path={item.glyph} fallback={item.icon} />
            </span>
            <span className={cnShellRecipes.railLabel}>{item.shortLabel}</span>
          </Link>
        );
      })}

      <div className={cnShellRecipes.railFooter}>
        <button
          type="button"
          className={cnShellRecipes.railItem}
          disabled={signingOut}
          onClick={() => startSignOut(() => void signOut({ callbackUrl: "/login" }))}
        >
          <span className={cnShellRecipes.railIcon}>
            <Glyph path={SIGN_OUT_GLYPH} />
          </span>
          <span className={cnShellRecipes.railLabel}>{signingOut ? "Saliendo" : "Salir"}</span>
        </button>
        <UserAvatar user={user} />
        {version ? (
          <Link href={NOVEDADES_HREF} aria-label={`Versión ${version}. Ver novedades`} className={cnShellRecipes.version}>
            v{version}
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
