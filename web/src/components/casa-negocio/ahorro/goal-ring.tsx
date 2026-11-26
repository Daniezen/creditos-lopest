import Link from "next/link";

import { cnAhorroRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import { pesos } from "@/features/casa-negocio/domain";

import { CASA_NEGOCIO_HREF } from "../shell/rail-items";

/**
 * SVG geometry of the canvas ring (viewBox units, not visual tokens): a
 * circle of radius 48 in a 120 box, stroke 13. The dash is the share of the
 * circumference reached, capped at a full turn once the goal is met.
 */
const BOX = 120;
const RADIUS = 48;
const STROKE = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ringDash(porcentaje: number): string {
  const share = Math.min(1, Math.max(0, porcentaje / 100));
  return `${(share * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`;
}

/**
 * «Anillo de avance a la meta» (`Ahorro.dc.html`, left card): the share of
 * the goal reached, the savings balance, the goal and what is still missing.
 * Without a goal the ring stays empty and offers Configuración to set one.
 */
export function GoalRing({
  cuenta,
  meta,
  puedeConfigurar,
}: {
  cuenta: { nombre: string; saldo: number };
  meta: { monto: number; porcentaje: number; falta: number } | null;
  puedeConfigurar: boolean;
}) {
  const porcentaje = meta?.porcentaje ?? 0;
  const label = meta ? `${porcentaje} por ciento de la meta de ahorro` : "Sin meta de ahorro";

  return (
    <section aria-labelledby="ahorro-meta" className={cnAhorroRecipes.goal}>
      <div className={cnAhorroRecipes.ring}>
        <svg viewBox={`0 0 ${BOX} ${BOX}`} className={cnAhorroRecipes.ringSvg} role="img" aria-label={label}>
          <circle cx={BOX / 2} cy={BOX / 2} r={RADIUS} strokeWidth={STROKE} className={cnAhorroRecipes.ringTrack} />
          {meta && porcentaje > 0 ? (
            <circle
              cx={BOX / 2}
              cy={BOX / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={ringDash(porcentaje)}
              className={cnAhorroRecipes.ringFill}
            />
          ) : null}
        </svg>
        <div className={cnAhorroRecipes.ringCenter} aria-hidden="true">
          <span className={cnAhorroRecipes.ringFigure}>{meta ? `${porcentaje} %` : "—"}</span>
          <span className={cnAhorroRecipes.ringCaption}>{meta ? "de la meta" : "sin meta"}</span>
        </div>
      </div>
      <div className={cnAhorroRecipes.goalText}>
        <h2 id="ahorro-meta" className={cnAhorroRecipes.goalEyebrow}>
          {cuenta.nombre}
        </h2>
        <div className={cnAhorroRecipes.goalBalance}>{pesos(cuenta.saldo)}</div>
        {meta ? (
          <>
            <div className={cnAhorroRecipes.goalDetail}>Meta {pesos(meta.monto)}</div>
            <div className={cnAhorroRecipes.goalDetail}>{meta.falta > 0 ? `Faltan ${pesos(meta.falta)}` : "Meta cumplida"}</div>
          </>
        ) : puedeConfigurar ? (
          <Link href={`${CASA_NEGOCIO_HREF}/configuracion`} className={cnAhorroRecipes.goalLink}>
            Poner una meta
          </Link>
        ) : null}
      </div>
    </section>
  );
}
