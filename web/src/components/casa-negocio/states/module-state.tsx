import Link from "next/link";

import { cnStateRecipes } from "@/design-system/recipes/casa-negocio";

import type { CnAction } from "../types";

export interface ModuleStateProps {
  title: string;
  /** One short sentence; the canvas avoids explanatory text, so states say only what to do. */
  text?: string;
  action?: CnAction;
  /** `alert` for a failed load, so it is announced; `status` otherwise. */
  role?: "status" | "alert";
  children?: React.ReactNode;
}

/**
 * A whole-view state inside the paper sheet: nothing configured yet, no
 * access, or a failed load. Server component unless its children need the
 * client (the retry button of `error.tsx`).
 */
export function ModuleState({ title, text, action, role = "status", children }: ModuleStateProps) {
  return (
    <section role={role} aria-label={title} className={cnStateRecipes.card}>
      <h2 className={cnStateRecipes.title}>{title}</h2>
      {text ? <p className={cnStateRecipes.text}>{text}</p> : null}
      {action ? (
        <Link href={action.href} className={cnStateRecipes.action}>
          {action.label}
        </Link>
      ) : null}
      {children}
    </section>
  );
}
