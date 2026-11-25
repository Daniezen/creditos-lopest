import Link from "next/link";

import { cnNoticeRecipes } from "@/design-system/recipes/casa-negocio";

import type { CnAction, NoticeLevel } from "../types";
import { Glyph } from "./glyph";

/** Triangle for attention, octagon for problem: the level never depends on colour alone. */
const ICON: Record<NoticeLevel, string> = {
  atencion: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  problema: "M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9zM12 8v4M12 16h.01",
};

const SPOKEN: Record<NoticeLevel, string> = { atencion: "Atención: ", problema: "Problema: " };

export interface NoticeProps {
  level: NoticeLevel;
  children: React.ReactNode;
  action?: CnAction;
  className?: string;
}

/**
 * A notice of spec §5, placed beside what it affects and only when its rule
 * applies: `atencion` amber, `problema` red. The level is also spoken (hidden
 * prefix) and drawn by the icon's shape.
 */
export function Notice({ level, children, action, className }: NoticeProps) {
  return (
    <div className={[cnNoticeRecipes.base, cnNoticeRecipes[level], className ?? ""].join(" ").trim()}>
      <Glyph path={ICON[level]} className={cnNoticeRecipes.icon} strokeWidth={2.2} />
      <span>
        <span className="sr-only">{SPOKEN[level]}</span>
        {children}
        {action ? (
          <Link href={action.href} className={cnNoticeRecipes.action}>
            {action.label}
          </Link>
        ) : null}
      </span>
    </div>
  );
}
