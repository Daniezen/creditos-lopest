"use client";

import { useOptimistic, useState } from "react";

import { editarAvisoAction } from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";
import type { AvisoConfig } from "@/server/casa-negocio/vista-configuracion";

import { AVISOS, NIVEL_LABEL, textoAviso } from "./texto";
import { useAccion } from "./use-accion";

/**
 * «Avisos»: the ten rules of spec §5 with their switch, level square,
 * threshold typed in the sentence itself, and where each one shows up.
 * The switch saves at once (optimistically); the threshold on blur or Enter.
 */
export function Avisos({ avisos, puedeConfigurar }: { avisos: AvisoConfig[]; puedeConfigurar: boolean }) {
  return (
    <section aria-labelledby="cn-config-avisos" className={r.section}>
      <h2 id="cn-config-avisos" className={r.sectionTitle}>
        Avisos
      </h2>
      <div className={r.list}>
        {avisos.map((a) => (
          <Regla key={a.codigo} aviso={a} puedeConfigurar={puedeConfigurar} />
        ))}
      </div>
    </section>
  );
}

function Regla({ aviso, puedeConfigurar }: { aviso: AvisoConfig; puedeConfigurar: boolean }) {
  const def = AVISOS[aviso.codigo];
  const accion = useAccion();
  const [activa, setActivaOptimista] = useOptimistic(aviso.activa);
  const inicial = aviso.umbral === null ? "" : String(aviso.umbral);
  const [umbral, setUmbral] = useState(inicial);
  const [base, setBase] = useState(inicial);
  if (base !== inicial) {
    setBase(inicial);
    setUmbral(inicial);
  }

  const guardar = (cambios: { activa?: boolean; umbral?: string }) => {
    const siguienteActiva = cambios.activa ?? aviso.activa;
    accion.ejecutar(async () => {
      if (cambios.activa !== undefined) setActivaOptimista(cambios.activa);
      return editarAvisoAction({
        codigo: aviso.codigo,
        version: aviso.version,
        activa: String(siguienteActiva),
        umbral: def.despues === null ? "" : (cambios.umbral ?? inicial),
      });
    });
  };

  const frase = textoAviso(aviso.codigo, aviso.umbral);
  return (
    <div className={r.rule}>
      <button
        type="button"
        role="switch"
        aria-checked={activa}
        aria-label={frase}
        className={r.switch}
        disabled={!puedeConfigurar || accion.pendiente}
        onClick={() => guardar({ activa: !activa })}
      >
        <span aria-hidden="true" className={r.switchKnob} />
      </button>
      <span className={`${r.severity} ${r.severityTone[def.nivel]}`} title={NIVEL_LABEL[def.nivel]}>
        <span className="sr-only">{NIVEL_LABEL[def.nivel]}</span>
      </span>
      <span className={`${r.ruleText} ${activa ? r.ruleTextOn : r.ruleTextOff}`}>
        {def.antes}
        {def.despues !== null ? (
          <>
            <input
              className={r.umbral}
              inputMode="numeric"
              value={umbral}
              aria-label={`Valor: ${frase}`}
              readOnly={!puedeConfigurar}
              aria-invalid={accion.error ? true : undefined}
              onChange={(e) => setUmbral(e.target.value)}
              onBlur={() => {
                if (umbral.trim() !== inicial) guardar({ umbral: umbral.trim() });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setUmbral(inicial);
              }}
            />
            {def.despues}
          </>
        ) : null}
      </span>
      <span className={r.ruleWhere}>{def.donde}</span>
      {accion.error ? (
        <span role="alert" className={r.inlineError}>
          {accion.error}
        </span>
      ) : null}
    </div>
  );
}
