import type { LucideIcon } from "lucide-react";

/**
 * A canvas glyph: one 24×24 stroke path, drawn exactly as the approved
 * artboards draw their icons (stroke 1.8, round caps and joins). Decorative:
 * the accessible name always comes from the surrounding control.
 *
 * `fallback` renders a lucide icon when a destination has no canvas glyph yet.
 */
interface GlyphProps {
  path: string | null;
  fallback?: LucideIcon;
  /** Rendered size in Tailwind size steps; the drawing keeps its 24-unit box. */
  className?: string;
  strokeWidth?: number;
}

export function Glyph({ path, fallback: Fallback, className = "size-5", strokeWidth = 1.8 }: GlyphProps) {
  if (!path) {
    return Fallback ? <Fallback aria-hidden="true" className={className} strokeWidth={strokeWidth} /> : null;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}
