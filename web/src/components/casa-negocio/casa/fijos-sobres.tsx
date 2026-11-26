import { cnCardRecipes, cnCasaRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { FijoVista, SobreVista } from "@/server/casa-negocio/vista-casa";

import { formatMoney } from "../shared/format";
import { Glyph } from "../shared/glyph";
import { Notice } from "../shared/notice";

const CHECK = "M5 12l5 5 9-10";

const ANILLO: Record<FijoVista["estado"], string> = {
  pagado: cnCasaRecipes.checkPagado,
  vencido: cnCasaRecipes.checkVencido,
  porVenir: cnCasaRecipes.checkPorVenir,
  noToca: cnCasaRecipes.checkNoToca,
};

const ESTADO_HABLADO: Record<FijoVista["estado"], string> = {
  pagado: "pagado",
  vencido: "vencido sin pagar",
  porVenir: "por pagar",
  noToca: "no toca este mes",
};

/** «Fijos de noviembre»: a check per fixed expense, red ring when its day passed unpaid. */
export function FijosDelMes({ fijos, nombreMes }: { fijos: FijoVista[]; nombreMes: string }) {
  return (
    <section aria-labelledby="fijos-mes" className={cnCardRecipes.cardTight}>
      <h2 id="fijos-mes" className={cnCardRecipes.titleSm}>
        Fijos de {nombreMes}
      </h2>
      {fijos.length === 0 ? <p className={cnCardRecipes.hint}>Sin gastos fijos configurados.</p> : null}
      <ul>
        {fijos.map((f) => {
          const tenue = f.estado === "noToca";
          return (
            <li key={f.id}>
              <div className={cnCasaRecipes.fijo}>
                <span aria-hidden="true" className={`${cnCasaRecipes.check} ${ANILLO[f.estado]}`}>
                  {f.estado === "pagado" ? <Glyph path={CHECK} className="size-3" strokeWidth={3.2} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`${cnCasaRecipes.fijoName} ${tenue ? cnCasaRecipes.fijoFaint : ""}`}>
                    {f.nombre}
                    <span className="sr-only">, {ESTADO_HABLADO[f.estado]}</span>
                  </div>
                  <div className={f.estado === "vencido" ? cnCasaRecipes.fijoSubProblem : `${cnCasaRecipes.fijoSub} ${tenue ? cnCasaRecipes.fijoFaint : ""}`}>
                    {f.detalle}
                  </div>
                </div>
                <div className={`${cnCasaRecipes.fijoAmount} ${tenue ? cnCasaRecipes.fijoFaint : ""}`}>{formatMoney(f.monto)}</div>
              </div>
              {f.avisos.map((a) => (
                <Notice key={a.texto} level={a.nivel} className={cnCasaRecipes.fijoNotice}>
                  {a.texto}
                </Notice>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** «Sobres de noviembre»: what is left of each cap, amber near it, red past it. */
export function SobresDelMes({ sobres, nombreMes }: { sobres: SobreVista[]; nombreMes: string }) {
  return (
    <section aria-labelledby="sobres-mes" className={cnCardRecipes.cardTight}>
      <h2 id="sobres-mes" className={cnCardRecipes.titleSm}>
        Sobres de {nombreMes}
      </h2>
      {sobres.length === 0 ? <p className={cnCardRecipes.hint}>Sin sobres con tope.</p> : null}
      <ul>
        {sobres.map((s) => {
          const pasado = s.queda < 0;
          return (
            <li key={s.id} className={cnCasaRecipes.sobre}>
              <div className={cnCasaRecipes.sobreHead}>
                <span className={cnCasaRecipes.sobreName}>{s.nombre}</span>
                <span className={pasado ? cnCasaRecipes.sobreLeftOver : cnCasaRecipes.sobreLeft}>
                  {pasado ? `Pasado ${formatMoney(-s.queda)}` : `Quedan ${formatMoney(s.queda)}`}
                </span>
              </div>
              <div
                className={cnCasaRecipes.sobreTrack}
                role="meter"
                aria-label={`${s.nombre}: gastado ${formatMoney(s.gastado)} de ${formatMoney(s.tope)}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={s.ancho}
              >
                <div className={cnCasaRecipes.sobreFill[s.nivel]} style={{ width: `${s.ancho}%` }} />
              </div>
              {s.avisos.map((a) => (
                <Notice key={a.texto} level={a.nivel} className={cnCasaRecipes.sobreNotice}>
                  {a.texto}
                </Notice>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
