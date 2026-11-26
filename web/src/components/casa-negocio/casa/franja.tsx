import { cnIdentityRecipes } from "@/design-system/recipes/casa-negocio";
import { cnStripRecipes } from "@/design-system/recipes/casa-negocio-libros";

import { formatMoney } from "../shared/format";
import { Notice } from "../shared/notice";
import type { NoticeLevel } from "../types";

export interface TerminoFranja {
  op: "" | "−" | "=";
  label: string;
  monto: number;
  /** Results (after «=») are drawn on ink. */
  resultado?: boolean;
}

/**
 * «Casa este mes» / «Negocio este mes»: the identity label and the month's
 * equation as white wells joined by operators, results on ink. The
 * equation is spoken as one sentence too, since operators are decorative.
 */
export function Franja({
  identidad,
  terminos,
  aviso,
}: {
  identidad: "casa" | "negocio";
  terminos: TerminoFranja[];
  aviso?: { nivel: NoticeLevel; texto: string };
}) {
  const nombre = identidad === "casa" ? "Casa" : "Negocio";
  const frase = terminos.map((t) => `${t.op === "−" ? "menos " : t.op === "=" ? "igual a " : ""}${t.label} ${formatMoney(t.monto)}`).join(", ");
  return (
    <section aria-label={`${nombre} este mes`} className={`${cnStripRecipes.root} ${cnStripRecipes[identidad]}`}>
      <span className={`${cnStripRecipes.label} ${identidad === "casa" ? cnStripRecipes.labelCasa : cnStripRecipes.labelNegocio}`}>
        <span aria-hidden="true" className={`${cnStripRecipes.labelSwatch} ${identidad === "casa" ? cnIdentityRecipes.dotCasa : cnIdentityRecipes.dotNegocio}`} />
        {nombre}
      </span>
      <span className="sr-only">{frase}</span>
      {terminos.map((t) => (
        <span key={t.label} aria-hidden="true" className="contents">
          {t.op ? <span className={cnStripRecipes.operator}>{t.op}</span> : null}
          <span className={t.resultado ? cnStripRecipes.termResult : cnStripRecipes.term}>
            <span className={t.resultado ? cnStripRecipes.termLabelResult : cnStripRecipes.termLabel}>{t.label}</span>
            <span className={t.resultado ? cnStripRecipes.termValueResult : cnStripRecipes.termValue}>{formatMoney(t.monto)}</span>
          </span>
        </span>
      ))}
      {aviso ? (
        <div className={cnStripRecipes.notice}>
          <Notice level={aviso.nivel}>{aviso.texto}</Notice>
        </div>
      ) : null}
    </section>
  );
}
