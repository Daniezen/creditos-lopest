import { cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { formatMillions } from "../shared/format";
import type { MoneyPathData } from "../types";
import { moneyPathSteps } from "./money-path-geometry";

/**
 * «Por dónde pasó la plata» (`Main.dc.html`): what entered the business,
 * where it went, and how the house used its part — three aligned bars whose
 * widths are shares of step 1 (`money-path-geometry.ts`). Small parts keep
 * their colour but drop the caption; every part is still listed for
 * assistive technology, and on phones that list is the visible legend.
 */
export function MoneyPath({ data }: { data: MoneyPathData }) {
  const steps = moneyPathSteps(data);
  return (
    <section aria-labelledby="cn-flujo" className={[r.card, r.path].join(" ")}>
      <h2 id="cn-flujo" className={r.pathTitle}>
        Por dónde pasó la plata
      </h2>
      {steps.map((step) => (
        <div key={step.n}>
          <div className={r.pathStep}>
            <div className={r.pathHead}>
              <span aria-hidden="true" className={r.pathNumber}>
                {step.n}
              </span>
              <div>
                <h3 className={r.pathStepTitle}>{step.title}</h3>
                <div className={r.pathTotal}>{formatMillions(step.total)}</div>
                {step.note ? (
                  <div className={step.noteTone === "problem" ? r.pathNoteProblem : r.pathNote}>{step.note}</div>
                ) : null}
              </div>
            </div>
            <div style={{ marginLeft: `${step.offsetPct.toFixed(2)}%`, width: `${step.widthPct.toFixed(2)}%` }}>
              <div aria-hidden="true" className={r.pathBar}>
                {step.parts.map((part) => (
                  <span key={part.key} className={[r.pathSegment, r.swatch[part.swatch]].join(" ")} style={{ flexGrow: part.weight }} />
                ))}
              </div>
              <div aria-hidden="true" className={r.pathCaptions}>
                {step.parts.map((part) => (
                  <span key={part.key} className={r.pathCaption} style={{ flexGrow: part.weight }}>
                    {part.showLabel ? (
                      <>
                        <span className={[r.pathCaptionLabel, r.tone[part.tone]].join(" ")}>{part.label}</span>
                        <span className={r.pathCaptionValue}>{formatMillions(part.amount)}</span>
                      </>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
            {/* Desktop: read by assistive technology only (the captions show it).
                Phones: the visible legend, because captions that never wrap
                would run past a 375 px card. */}
            <ul className={r.pathLegend}>
              {step.parts.map((part) => (
                <li key={part.key} className={r.pathLegendItem}>
                  <span aria-hidden="true" className={[r.pathLegendSwatch, r.swatch[part.swatch]].join(" ")} />
                  <span className={r.tone[part.tone]}>{part.label}</span>
                  <span className={r.pathCaptionValue}>{formatMillions(part.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          {step.arrow ? (
            <div aria-hidden="true" className={r.pathArrowRow}>
              <span />
              <div className={r.pathArrowTrack}>
                <span
                  className={[r.pathArrow, step.arrow.tone === "casa" ? r.pathArrowCasa : r.pathArrowFaint].join(" ")}
                  style={{ left: `${step.arrow.atPct.toFixed(2)}%` }}
                >
                  ↓
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
