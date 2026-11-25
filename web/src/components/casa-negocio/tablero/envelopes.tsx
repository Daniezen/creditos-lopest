import { cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { formatMoney } from "../shared/format";
import type { Envelope } from "../types";
import { DEFAULT_NEAR_SHARE, envelopeFillPct, envelopeState } from "./envelope-state";

export interface EnvelopesProps {
  envelopes: Envelope[];
  /** Share of the cap that turns an envelope amber (Configuración, default 0,9). */
  nearShare?: number;
}

/**
 * «Sobres de la casa» (`Main.dc.html`): each variable expense as an envelope
 * with what is left, its cap, and a spent bar; the flap and ring turn amber
 * near the cap and red past it (`envelope-state.ts`). On phones they scroll
 * sideways (`TableroMovil.dc.html`).
 */
export function Envelopes({ envelopes, nearShare = DEFAULT_NEAR_SHARE }: EnvelopesProps) {
  const cap = envelopes.reduce((sum, envelope) => sum + envelope.cap, 0);
  const spent = envelopes.reduce((sum, envelope) => sum + envelope.spent, 0);

  return (
    <section aria-labelledby="cn-sobres" className={r.envelopes}>
      <div className={r.envelopesHead}>
        <h2 id="cn-sobres" className={r.sectionTitle}>
          Sobres de la casa
        </h2>
        <span className={r.envelopesSummary}>
          Quedan {formatMoney(cap - spent)} de {formatMoney(cap)}
        </span>
      </div>
      <ul className={r.envelopesGrid}>
        {envelopes.map((envelope) => {
          const state = envelopeState(envelope.spent, envelope.cap, nearShare);
          const over = state === "pasado";
          return (
            <li key={envelope.id} className={[r.envelope, r.envelopeRing[state]].join(" ")}>
              <svg viewBox="0 0 200 26" preserveAspectRatio="none" aria-hidden="true" focusable="false" className={r.envelopeFlap}>
                <path d="M0 0 L100 24 L200 0 Z" className={r.envelopeFlapFill[state]} />
              </svg>
              <h3 className={r.envelopeName}>{envelope.name}</h3>
              <div className={[r.envelopeLeft, over ? r.envelopeLeftOver : ""].join(" ")}>
                {formatMoney(envelope.cap - envelope.spent)}
              </div>
              <div className={r.envelopeSub}>
                {over ? `Pasado del tope de ${formatMoney(envelope.cap)}` : `de ${formatMoney(envelope.cap)}`}
              </div>
              <div aria-hidden="true" className={r.envelopeTrack}>
                <div className={r.envelopeFill[state]} style={{ width: `${envelopeFillPct(envelope.spent, envelope.cap)}%` }} />
              </div>
              <span className="sr-only">Gastado {formatMoney(envelope.spent)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
