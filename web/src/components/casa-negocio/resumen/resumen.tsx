import Link from "next/link";

import { cnResumenRecipes as r, cnTypeRecipes } from "@/design-system/recipes/casa-negocio";
import type { TramoAtraso } from "@/features/casa-negocio/types";
import {
  MESES_GRAFICA,
  MESES_PROYECCION,
  RANGOS_RESUMEN,
  type RangoResumen,
  type TarjetaMes,
  type VistaResumen,
} from "@/server/casa-negocio/vista-resumen";

import { formatMillions } from "../shared/format";
import { Notice } from "../shared/notice";
import { GraficaCobros, GraficaGanancia } from "./graficas";
import { mesCorto, millonesCorto, pesosLargo } from "./opciones";

/**
 * Resumen tab (`Resumen.dc.html`): ganancia y retiros, cobros (history +
 * projection), how the portfolio is paying, and month by month. Server
 * component; only the two drawings are client islands.
 *
 * Every chart is followed by its text reading and an off-screen data table,
 * so the numbers are reachable without the drawing.
 */
export interface ResumenProps {
  vista: VistaResumen;
  /** Link of each «mes a mes» range option. */
  rangoHref: (rango: RangoResumen) => string;
}

const TRAMO_SWATCH: Record<TramoAtraso, keyof typeof r.swatch> = {
  AL_DIA: "ink",
  "1_30": "ink-soft",
  "31_60": "ink-faint",
  "61_90": "attention",
  MAS_90: "problem",
};

function LegendSquare({ swatch, children }: { swatch: keyof typeof r.swatch; children: React.ReactNode }) {
  return (
    <span className={r.legendItem}>
      <span aria-hidden="true" className={`${r.legendSquare} ${r.swatch[swatch]}`} />
      {children}
    </span>
  );
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function mesLargo(mes: string) {
  return `${mesCorto(mes)} ${mes.slice(0, 4)}`;
}

/** Off-screen table: the chart's data for screen readers. */
function TablaOculta({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <table className={cnTypeRecipes.srOnly}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SeccionGanancia({ vista }: { vista: VistaResumen["ganancia"] }) {
  return (
    <section aria-labelledby="cn-resumen-ganancia" className={r.card}>
      <div className={r.head}>
        <h2 id="cn-resumen-ganancia" className={r.title}>
          Ganancia y retiros
        </h2>
        <div className={r.legend} aria-hidden="true">
          <span className={r.legendItem}>
            <span className={r.legendLine} />
            Ganancia neta
          </span>
          <LegendSquare swatch="casa">A la casa</LegendSquare>
          <LegendSquare swatch="alert">El capital bajó</LegendSquare>
        </div>
      </div>
      {vista.meses.length === 0 ? (
        <p className={r.empty}>Todavía no hay meses con cobros.</p>
      ) : (
        <>
          <GraficaGanancia vista={vista} label={`Ganancia neta y retiros a la casa, últimos ${vista.meses.length} meses`} />
          <p className={cnTypeRecipes.srOnly}>{vista.lectura}</p>
          <TablaOculta
            caption="Ganancia y retiros por mes"
            head={["Mes", "Ganancia neta", "A la casa", "Reinvertido"]}
            rows={vista.meses.map((m) => [
              mesLargo(m.mes),
              pesosLargo(m.ganancia),
              m.retiros === null ? "no se anotaba" : pesosLargo(m.retiros),
              m.reinvertido === null ? "no se anotaba" : pesosLargo(m.reinvertido),
            ])}
          />
        </>
      )}
      {vista.aviso ? (
        <div>
          <Notice level="problema">{vista.aviso}</Notice>
        </div>
      ) : null}
    </section>
  );
}

function SeccionCobros({ vista }: { vista: VistaResumen["cobros"] }) {
  const historia = vista.indiceHoy;
  const kpis = [
    {
      label: `Cobrado en ${historia === MESES_GRAFICA ? "12 meses" : plural(historia, "mes", "meses")}`,
      valor: formatMillions(vista.cobrado),
      sub: vista.cumplimiento === null ? "Sin cuotas programadas" : `${vista.cumplimiento} % de lo que tocaba cobrar`,
    },
    { label: `Viene en ${MESES_PROYECCION} meses`, valor: formatMillions(vista.viene), sub: "Si todos pagan a tiempo" },
    { label: "De eso, intereses", valor: formatMillions(vista.vieneIntereses), sub: "La cartera baja si no se presta más" },
  ];
  const vacio = vista.meses.every((m) => m.total === 0 && !m.esperado);

  return (
    <section aria-labelledby="cn-resumen-cobros" className={r.card}>
      <div className={r.head}>
        <h2 id="cn-resumen-cobros" className={r.title}>
          Cobros: lo que entró y lo que viene
        </h2>
        <div className={r.legend} aria-hidden="true">
          <LegendSquare swatch="ink">Interés</LegendSquare>
          <LegendSquare swatch="ink-soft">Capital</LegendSquare>
          <span className={r.legendItem}>
            <span className={r.legendDashed} />
            Lo que tocaba cobrar
          </span>
          <span className={r.legendItem}>
            <span className={r.legendFuture} />
            Por venir
          </span>
        </div>
      </div>
      {vacio ? (
        <p className={r.empty}>Todavía no hay cobros ni cuotas por venir.</p>
      ) : (
        <>
          <GraficaCobros
            vista={vista}
            label={`Cobros mensuales de los últimos ${historia} meses y proyección de los próximos ${MESES_PROYECCION}`}
          />
          <p className={cnTypeRecipes.srOnly}>{vista.lectura}</p>
          <TablaOculta
            caption="Cobros por mes"
            head={["Mes", "Capital", "Interés", "Total", "Tocaba cobrar"]}
            rows={vista.meses.map((m) => [
              `${mesLargo(m.mes)}${m.proyectado ? " (por venir)" : ""}`,
              pesosLargo(m.capital),
              pesosLargo(m.interes),
              pesosLargo(m.total),
              m.esperado === null ? "—" : pesosLargo(m.esperado),
            ])}
          />
        </>
      )}
      <div className={r.kpis}>
        {kpis.map((k) => (
          <div key={k.label} className={r.kpi}>
            <span className={r.kpiLabel}>{k.label}</span>
            <span className={r.kpiValue}>{k.valor}</span>
            <span className={r.kpiSub}>{k.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SeccionCartera({ vista }: { vista: VistaResumen["cartera"] }) {
  const conSaldo = vista.tramos.filter((t) => t.saldo > 0);
  return (
    <div className={r.row}>
      <section aria-labelledby="cn-resumen-cartera" className={`${r.card} ${r.tramos}`}>
        <h2 id="cn-resumen-cartera" className={r.title}>
          Cómo está pagando la cartera
        </h2>
        {conSaldo.length === 0 ? (
          <p className={r.empty}>No hay créditos activos.</p>
        ) : (
          <>
            <div className={r.tramoBar} role="img" aria-label={vista.lectura}>
              {conSaldo.map((t) => (
                // The share of each bucket is data, not a visual value.
                <span key={t.tramo} className={`${r.tramoSegment} ${r.swatch[TRAMO_SWATCH[t.tramo]]}`} style={{ flexGrow: t.saldo }} />
              ))}
            </div>
            <ul className={r.tramoList}>
              {vista.tramos.map((t) => (
                <li key={t.tramo} className={r.tramoRow}>
                  <span aria-hidden="true" className={`${r.tramoSwatch} ${r.swatch[TRAMO_SWATCH[t.tramo]]}`} />
                  <span className={r.tramoLabel}>{t.label}</span>
                  <span className={r.tramoCount}>{plural(t.creditos, "crédito", "créditos")}</span>
                  <span className={r.tramoValue}>{formatMillions(t.saldo)}</span>
                </li>
              ))}
            </ul>
            <div className={r.tramoTotal}>
              <span>En la calle · {plural(vista.creditos, "crédito", "créditos")}</span>
              <span className={cnTypeRecipes.figureXsMedium}>{formatMillions(vista.enLaCalle)}</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Valor({ valor, actual, tono }: { valor: number | null; actual: boolean; tono?: "signo" }) {
  if (valor === null) return <div className={`${r.monthValue} ${r.monthMuted}`}>—</div>;
  let clase = r.monthValue;
  if (tono === "signo") {
    if (valor < 0) clase += ` ${actual ? r.monthLossOnInk : r.monthLoss}`;
    else clase += ` ${actual ? r.monthGainOnInk : r.monthGain}`;
  }
  const texto = tono === "signo" && valor >= 0 ? `+${millonesCorto(valor)} M` : `${millonesCorto(valor)} M`;
  return <div className={clase}>{texto}</div>;
}

function Tarjeta({ t }: { t: TarjetaMes }) {
  return (
    <li className={`${r.month} ${t.actual ? r.monthActual : r.monthPast}`} aria-current={t.actual ? "date" : undefined}>
      <div className={r.monthName}>{mesLargo(t.mes)}</div>
      <div>
        <div className={r.monthLabel}>Ganancia</div>
        <div className={r.monthFigure}>{formatMillions(t.ganancia)}</div>
      </div>
      <div className={r.monthGrid}>
        <div>
          <div className={r.monthLabel}>A la casa</div>
          <Valor valor={t.retiros} actual={t.actual} />
        </div>
        <div>
          <div className={r.monthLabel}>Reinvertido</div>
          <Valor valor={t.reinvertido} actual={t.actual} tono="signo" />
        </div>
        <div>
          <div className={r.monthLabel}>Casa sobró</div>
          <Valor valor={t.casaSobro} actual={t.actual} />
        </div>
        <div>
          <div className={r.monthLabel}>Ahorro</div>
          <Valor valor={t.ahorro} actual={t.actual} />
        </div>
      </div>
    </li>
  );
}

function SeccionMeses({ tarjetas, rango, rangoHref }: { tarjetas: TarjetaMes[]; rango: RangoResumen; rangoHref: ResumenProps["rangoHref"] }) {
  return (
    <section aria-labelledby="cn-resumen-meses" className={r.months}>
      <div className={r.monthsHead}>
        <h2 id="cn-resumen-meses" className={cnTypeRecipes.srOnly}>
          Mes a mes
        </h2>
        <nav aria-label="Meses que se muestran" className={r.range}>
          {RANGOS_RESUMEN.map((op) => (
            <Link key={op} href={rangoHref(op)} aria-current={op === rango} className={r.rangeOption} scroll={false}>
              {op} meses
            </Link>
          ))}
        </nav>
      </div>
      {/* Focusable so the keyboard can scroll it; newest month first. */}
      <div className={r.monthsTrack} tabIndex={0} role="region" aria-label="Mes a mes, del más reciente al más antiguo">
        <ol className={r.monthsList}>
          {tarjetas.map((t) => (
            <Tarjeta key={t.mes} t={t} />
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Resumen({ vista, rangoHref }: ResumenProps) {
  return (
    <>
      <SeccionGanancia vista={vista.ganancia} />
      <SeccionCobros vista={vista.cobros} />
      <SeccionCartera vista={vista.cartera} />
      <SeccionMeses tarjetas={vista.tarjetas} rango={vista.rango} rangoHref={rangoHref} />
    </>
  );
}
