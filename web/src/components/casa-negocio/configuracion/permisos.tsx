"use client";

import { useOptimistic, useState } from "react";

import { definirPermisosAction } from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";
import type { Capacidad } from "@/features/casa-negocio/types";
import type { PersonaConfig } from "@/server/casa-negocio/vista-configuracion";

import { CAPACIDADES_COLUMNAS, ULTIMO_CONFIGURADOR, alternarCapacidad, quitariaUltimoConfigurador } from "./texto";
import { useAccion } from "./use-accion";

const CHECK = "M5 12l5 5 9-10";
const DASH = "M8 12h8";

/**
 * «Quién puede qué»: Lopest's users × the four capabilities. Each square is a
 * switch that saves at once. The last configurator cannot lose CONFIGURAR:
 * the server refuses it (configuracion.ts, under an advisory lock); the UI
 * only explains it without the round trip.
 */
export function Permisos({ personas, puedeConfigurar }: { personas: PersonaConfig[]; puedeConfigurar: boolean }) {
  const accion = useAccion();
  const [errorLocal, setErrorLocal] = useState<{ userId: string; mensaje: string } | null>(null);
  const [vista, aplicar] = useOptimistic(personas, (actual, { userId, capacidades }: { userId: string; capacidades: Capacidad[] }) =>
    actual.map((p) => (p.userId === userId ? { ...p, capacidades } : p)),
  );
  const [ultimo, setUltimo] = useState<string | null>(null);

  const alternar = (persona: PersonaConfig, capacidad: Capacidad) => {
    const siguientes = alternarCapacidad(persona.capacidades, capacidad);
    setUltimo(persona.userId);
    if (quitariaUltimoConfigurador(vista, persona.userId, siguientes)) {
      setErrorLocal({ userId: persona.userId, mensaje: ULTIMO_CONFIGURADOR });
      return;
    }
    setErrorLocal(null);
    accion.ejecutar(async () => {
      aplicar({ userId: persona.userId, capacidades: siguientes });
      return definirPermisosAction({ userId: persona.userId, capacidades: siguientes });
    });
  };

  return (
    <section aria-labelledby="cn-config-permisos" className={r.section}>
      <h2 id="cn-config-permisos" className={r.sectionTitle}>
        Quién puede qué
      </h2>
      <div className={r.matrixWrap}>
        {vista.length === 0 ? (
          <p className={r.columnEmpty}>No hay personas activas en Lopest.</p>
        ) : (
          <table className={r.matrix}>
            <thead>
              <tr className={r.matrixHead}>
                <th scope="col" className={r.matrixHeadPerson}>
                  Persona
                </th>
                {CAPACIDADES_COLUMNAS.map((c) => (
                  <th key={c.capacidad} scope="col" className={r.matrixHeadCap}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vista.map((p) => {
                const mensaje = errorLocal?.userId === p.userId ? errorLocal.mensaje : ultimo === p.userId ? accion.error : null;
                return (
                  <Fila key={p.userId} persona={p} puedeConfigurar={puedeConfigurar} ocupado={accion.pendiente} mensaje={mensaje} onAlternar={alternar} />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Fila({
  persona,
  puedeConfigurar,
  ocupado,
  mensaje,
  onAlternar,
}: {
  persona: PersonaConfig;
  puedeConfigurar: boolean;
  ocupado: boolean;
  mensaje: string | null;
  onAlternar: (p: PersonaConfig, c: Capacidad) => void;
}) {
  return (
    <>
      <tr className={r.matrixRow}>
        <th scope="row" className={r.matrixPerson}>
          <span className={r.person}>
            <span className={r.personAvatar} aria-hidden="true">
              {persona.imagen ? (
                // Login photos are small local files; next/image would need remote config.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={persona.imagen} alt="" className={r.personImage} />
              ) : (
                persona.iniciales
              )}
            </span>
            <span>
              {persona.nombre}
              {persona.esUsted || !persona.activo ? (
                <span className={r.personMeta}>{persona.esUsted ? "Tú" : "Inactivo en Lopest"}</span>
              ) : null}
            </span>
          </span>
        </th>
        {CAPACIDADES_COLUMNAS.map(({ capacidad, label }) => {
          const tiene = persona.capacidades.includes(capacidad);
          return (
            <td key={capacidad} className={r.matrixCell}>
              <button
                type="button"
                role="switch"
                aria-checked={tiene}
                aria-label={`${persona.nombre}: ${label}`}
                className={r.capToggle}
                disabled={!puedeConfigurar || ocupado || (!persona.activo && !tiene)}
                onClick={() => onAlternar(persona, capacidad)}
              >
                <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={tiene ? CHECK : DASH} />
                </svg>
              </button>
            </td>
          );
        })}
      </tr>
      {mensaje ? (
        <tr>
          <td colSpan={CAPACIDADES_COLUMNAS.length + 1} role="alert" className={r.matrixError}>
            {mensaje}
          </td>
        </tr>
      ) : null}
    </>
  );
}
