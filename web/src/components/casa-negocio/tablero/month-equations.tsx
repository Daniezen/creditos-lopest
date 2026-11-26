import { Fragment } from "react";

import { cnIdentityRecipes, cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { formatMoney } from "../shared/format";
import { Notice } from "../shared/notice";
import type { CnIdentity, EquationRow } from "../types";

const NAME_TONE: Record<CnIdentity, string> = {
  negocio: cnIdentityRecipes.textNegocio,
  casa: cnIdentityRecipes.textCasa,
  ahorro: cnIdentityRecipes.textAhorro,
};

/** Operators are read aloud as words, not symbols. */
const SPOKEN_OP: Record<string, string> = { "+": "más", "−": "menos", "=": "igual a" };

/**
 * «Las cuentas del mes» (`Main.dc.html`): each identity's month as an
 * equation of boxed terms, results on ink, with its notices right under it
 * when a rule applies. On phones each row becomes a card of lines
 * (`TableroMovil.dc.html`).
 */
export function MonthEquations({ rows }: { rows: EquationRow[] }) {
  return (
    <section aria-labelledby="cn-cuentas-mes" className={[r.card, r.equations].join(" ")}>
      <h2 id="cn-cuentas-mes" className={r.equationsTitle}>
        Las cuentas del mes
      </h2>
      {rows.map((row) => (
        <Fragment key={row.name}>
          <div role="group" aria-label={row.name} className={r.equationRow}>
            <span aria-hidden="true" className={[r.equationName, NAME_TONE[row.identity]].join(" ")}>
              {row.name}
            </span>
            {row.terms.map((term) => (
              <Fragment key={term.label}>
                {term.op ? (
                  <span className={r.operator}>
                    <span aria-hidden="true">{term.op}</span>
                    <span className="sr-only">{SPOKEN_OP[term.op]}</span>
                  </span>
                ) : null}
                <span className={[r.term, term.result ? r.termResult : ""].join(" ")}>
                  <span className={term.result ? r.termLabelResult : r.termLabel}>{term.label}</span>
                  <span className={term.result ? r.termValueResult : r.termValue}>{formatMoney(term.amount)}</span>
                </span>
              </Fragment>
            ))}
          </div>
          {row.notices?.map((notice) => (
            <Notice key={notice.text} level={notice.level} action={notice.action} className={`${r.equationNotice} max-md:hidden`}>
              {notice.text}
            </Notice>
          ))}

          <div className={r.equationCard}>
            <h3 className={[r.equationCardName, NAME_TONE[row.identity]].join(" ")}>{row.name}</h3>
            <dl>
              {row.terms.map((term) => (
                <div key={term.label} className={r.equationLine}>
                  <dt className={r.equationLineLabel}>
                    {term.op ? <span aria-hidden="true">{term.op} </span> : null}
                    {term.label}
                  </dt>
                  <dd className={term.result ? r.equationLineResult : r.equationLineValue}>{formatMoney(term.amount)}</dd>
                </div>
              ))}
            </dl>
            {row.notices?.map((notice) => (
              <Notice key={notice.text} level={notice.level} action={notice.action} className={r.equationCardNotice}>
                {notice.text}
              </Notice>
            ))}
          </div>
        </Fragment>
      ))}
    </section>
  );
}
