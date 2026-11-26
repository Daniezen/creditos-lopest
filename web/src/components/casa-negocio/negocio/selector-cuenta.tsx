"use client";

import { useId, useRef, useState } from "react";

import { asignarCuentaAction } from "@/app/(casa-negocio)/casa-negocio/negocio/actions";
import { cnNegocioRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { CuentaOpcion } from "@/server/casa-negocio/vista-casa";
import type { Asignacion } from "@/server/casa-negocio/vista-negocio";

import { useEnvio } from "../casa/campos";

/** Marks every picker so focus can jump to the next one after a save. */
const MARCA = "data-asignar";

/**
 * «¿Dónde entró?» / «¿De dónde salió?» inline: the account select starts on
 * the suggested account and «Guardar» stores the assignment with the phase-1
 * service. Built for runs of several pending rows: one click per row, and
 * after each save the focus moves to the next picker on the page, so the
 * keyboard flow is Enter, Enter, Enter. A select that saved on change was
 * avoided on purpose: arrow keys change a closed select in some browsers
 * and would assign by accident.
 */
export function SelectorCuenta({
  asignacion,
  fecha,
  cuentas,
  sugerida,
  contexto,
}: {
  asignacion: Asignacion;
  /** Day of the movement: accounts opened after it are not offered. */
  fecha: string;
  cuentas: CuentaOpcion[];
  sugerida: string | null;
  /** What it is, for the accessible name («Cuota 9 · LP-2»). */
  contexto: string;
}) {
  const id = useId();
  const posibles = cuentas.filter((c) => c.desde <= fecha);
  const [cuentaId, setCuentaId] = useState(posibles.some((c) => c.id === sugerida) ? sugerida! : (posibles[0]?.id ?? ""));
  const { pendiente, estado, enviar } = useEnvio<unknown>();
  const raiz = useRef<HTMLDivElement>(null);

  if (posibles.length === 0) return <span className={cnNegocioRecipes.assignLabel}>Sin cuenta</span>;

  function siguienteSelector(): HTMLSelectElement | null {
    // The book renders a table and phone cards; only the visible copy counts.
    const visibles = Array.from(document.querySelectorAll<HTMLSelectElement>(`select[${MARCA}]`)).filter((s) => s.offsetParent !== null);
    const propio = raiz.current?.querySelector<HTMLSelectElement>(`select[${MARCA}]`) ?? null;
    const i = propio ? visibles.indexOf(propio) : -1;
    return visibles.slice(i + 1).find((s) => !s.disabled) ?? null;
  }

  function guardar() {
    const siguiente = siguienteSelector();
    enviar(
      () =>
        asignarCuentaAction({
          eventoFinancieroId: asignacion.eventoFinancieroId ?? "",
          creditoId: asignacion.creditoId ?? "",
          cuentaId,
          version: asignacion.version ?? "",
        }),
      () => siguiente?.focus(),
    );
  }

  return (
    <div ref={raiz} className={cnNegocioRecipes.assign}>
      <label htmlFor={id} className={cnNegocioRecipes.assignLabel}>
        {asignacion.pregunta}
        <span className="sr-only"> {contexto}</span>
      </label>
      <select
        id={id}
        {...{ [MARCA]: "" }}
        className={cnNegocioRecipes.assignSelect}
        value={cuentaId}
        disabled={pendiente}
        aria-invalid={estado.campos.cuentaId ? true : undefined}
        onChange={(e) => setCuentaId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            guardar();
          }
        }}
      >
        {posibles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <button type="button" className={cnNegocioRecipes.assignSave} disabled={pendiente} aria-busy={pendiente} onClick={guardar}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      {!estado.ok && estado.mensaje ? (
        <span role="alert" className={cnNegocioRecipes.assignError}>
          {estado.mensaje}
        </span>
      ) : null}
    </div>
  );
}
