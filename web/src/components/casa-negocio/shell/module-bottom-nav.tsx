"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { NOVEDADES_HREF } from "@/components/versiones/version-footer-link";
import { cnMobileNavRecipes } from "@/design-system/recipes/casa-negocio";

import { Glyph } from "../shared/glyph";
import { buildRailItems, isRailItemActive, MORE_GLYPH, SIGN_OUT_GLYPH, splitMobileItems } from "./rail-items";

/**
 * Dark bottom navigation of Casa y Negocio on phones (`TableroMovil.dc.html`):
 * Clientes, Créditos, Casa, Reportes and «Más». «Más» opens a sheet with the
 * remaining destinations, sign-out and the version; it closes with Escape,
 * the backdrop or a destination, and returns focus to its trigger.
 */
export function ModuleBottomNav({ version }: { version: string | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { primary, more } = splitMobileItems(buildRailItems());
  const moreActive = more.some((item) => isRailItemActive(item.href, pathname));

  useEffect(() => {
    if (!moreOpen) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Cerrar más opciones"
            className={cnMobileNavRecipes.backdrop}
            onClick={() => setMoreOpen(false)}
          />
          <div ref={sheetRef} id="cn-more-sheet" role="dialog" aria-modal="true" aria-label="Más opciones" className={cnMobileNavRecipes.sheet}>
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isRailItemActive(item.href, pathname) ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className={cnMobileNavRecipes.sheetItem}
              >
                <Glyph path={item.glyph} fallback={item.icon} />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => startSignOut(() => void signOut({ callbackUrl: "/login" }))}
              className={cnMobileNavRecipes.sheetItem}
            >
              <Glyph path={SIGN_OUT_GLYPH} />
              {signingOut ? "Saliendo…" : "Cerrar sesión"}
            </button>
            {version ? (
              <Link href={NOVEDADES_HREF} onClick={() => setMoreOpen(false)} className={cnMobileNavRecipes.sheetVersion}>
                Versión {version}
              </Link>
            ) : null}
          </div>
        </>
      ) : null}

      <nav aria-label="Navegación principal" className={cnMobileNavRecipes.bar}>
        {primary.map((item) => {
          const active = isRailItemActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cnMobileNavRecipes.item}
            >
              <span className={[cnMobileNavRecipes.icon, active ? cnMobileNavRecipes.iconActive : ""].join(" ")}>
                <Glyph path={item.glyph} fallback={item.icon} className="size-4.5" />
              </span>
              {item.shortLabel}
            </Link>
          );
        })}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-controls={moreOpen ? "cn-more-sheet" : undefined}
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
          className={cnMobileNavRecipes.item}
        >
          <span className={[cnMobileNavRecipes.icon, moreOpen ? cnMobileNavRecipes.iconActive : ""].join(" ")}>
            <Glyph path={MORE_GLYPH} className="size-4.5" />
          </span>
          Más
        </button>
      </nav>
    </>
  );
}
