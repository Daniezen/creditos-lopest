import Link from "next/link";

import { cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import type { NextActionData } from "../types";

/**
 * Phone Tablero (`TableroMovil.dc.html`): the first thing to do, ringed in
 * violet, with how many more wait after it. Hidden from 768 px, where the
 * month line and the calendar already show it.
 */
export function NextAction({ data }: { data: NextActionData }) {
  return (
    <Link href={data.href} className={r.next}>
      <span aria-hidden="true" className={r.nextBadge}>
        1
      </span>
      <span className={r.nextBody}>
        <span className={r.nextTitle}>{data.title}</span>
        <span className={r.nextDetail}>{data.detail}</span>
      </span>
      {data.more > 0 ? (
        <span className={r.nextMore}>
          <span aria-hidden="true">+{data.more}</span>
          <span className="sr-only">y {data.more} más</span>
        </span>
      ) : null}
    </Link>
  );
}
