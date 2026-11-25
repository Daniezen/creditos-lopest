import Link from "next/link";

import { cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { formatMoney } from "../shared/format";
import type { StreetData } from "../types";

/**
 * «En la calle» (`Main.dc.html`): the portfolio still out, in a dashed frame
 * because it is not in any account and is never added to the family's money.
 * Credits without payments for a while link to their list.
 */
export function OnTheStreet({ data }: { data: StreetData }) {
  return (
    <section aria-labelledby="cn-calle" className={r.street}>
      <h2 id="cn-calle" className={r.sectionTitle}>
        En la calle
      </h2>
      <div>
        <div className={r.streetAmount}>{formatMoney(data.amount)}</div>
        <div className={r.streetCount}>
          {data.activeCredits} {data.activeCredits === 1 ? "crédito activo" : "créditos activos"}
        </div>
      </div>
      {data.stale ? (
        <Link href={data.stale.href} className={r.streetLink}>
          <span>{data.stale.text}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  );
}
