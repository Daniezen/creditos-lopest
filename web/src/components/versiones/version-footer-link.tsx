"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { versionRecipes } from "@/design-system/recipes/versions";

export const NOVEDADES_HREF = "/novedades";

interface VersionFooterLinkProps {
  /** Current released version, or null when the changelog could not be read. */
  version: string | null;
  onNavigate?: () => void;
}

/**
 * «Versión X.Y.Z» at the foot of the navigation; opens Novedades.
 *
 * Renders nothing without a version: the server already logged why the
 * changelog was unreadable, and a dangling «Versión —» would only confuse.
 */
export function VersionFooterLink({ version, onNavigate }: VersionFooterLinkProps) {
  const pathname = usePathname();
  if (!version) return null;

  const active = pathname === NOVEDADES_HREF;

  return (
    <Link
      href={NOVEDADES_HREF}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={`Versión ${version}. Ver novedades`}
      className={[versionRecipes.footerLink, active ? versionRecipes.footerLinkActive : ""].join(" ")}
    >
      <span>
        Versión <span className={versionRecipes.footerVersion}>{version}</span>
      </span>
      <span className="flex items-center gap-1">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Novedades
      </span>
    </Link>
  );
}
