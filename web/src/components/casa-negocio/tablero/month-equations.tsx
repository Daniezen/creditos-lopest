import { Fragment } from "react";

import { cnIdentityRecipes, cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { formatMoney } from "../shared/format";
import { Notice } from "../shared/notice";
import type { CnIdentity, EquationRow } from "../types";
import { compactTerms } from "./equation-compact";

const NAME_TONE: Record<CnIdentity, string> = {
  negocio: cnIdentityRecipes.textNegocio,
  casa: cnIdentityRecipes.textCasa,
  ahorro: cnIdentityRecipes.textAhorro,
};

/** The phone card names Negocio in the soft ink of `TableroMovil.dc.html`. */
const CARD_NAME_TONE: Record<CnIdentity, string> = { ...NAME_TONE, negocio: r.equationCardNameNegocio };

/** Operators are read aloud as words, not symbols. */
const SPOKEN_OP: Record<string, string> = { "+": "más", "−": "menos", "=": "igual a" };

/**
 * «Las cuentas del mes» (`Main.dc.html`): each identity's month as an
 * equation of boxed terms, results on ink, with its notices right under it
 * when a rule applies. On phones each row becomes a card of lines
 * (`TableroMovil.dc.html`) with the shorter reading of `equation-compact.ts`.
 * A read-only viewer sees the notices without their actions («Pagar», «Ir a
 * Ahorro»), as in the detail windows.
 */
export function MonthEquations({ rows, readOnly = false }: { rows: EquationRow[]; readOnly?: boolean }) {
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
            <Notice
              key={notice.text}
              level={notice.level}
              action={readOnly ? undefined : notice.action}
              className={`${r.equationNotice} max-md:hidden`}
            >
              {notice.text}
            </Notice>
          ))}

          <div className={r.equationCard}>
            <h3 className={[r.equationCardName, CARD_NAME_TONE[row.identity]].join(" ")}>{row.name}</h3>
            <dl>
              {compactTerms(row).map((term) => (
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
              <Notice key={notice.text} level={notice.level} action={readOnly ? undefined : notice.action} className={r.equationCardNotice}>
                {notice.text}
              </Notice>
            ))}
          </div>
        </Fragment>
      ))}
    </section>
  );
}
