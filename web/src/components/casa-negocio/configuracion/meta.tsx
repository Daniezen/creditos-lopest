"use client";

import { useId, useState } from "react";

import { editarConfiguracionAction } from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { formatMoney } from "@/components/casa-negocio/shared/format";
import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";
import type { VistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

import { montoEntrada } from "./texto";
import { useAccion } from "./use-accion";

type Config = VistaConfiguracion["configuracion"];

/**
 * A goal of the settings row, edited in place: «Meta mensual para la casa»
 * (Gastos) and «Meta de ahorro» (Cuentas). Saved on blur or Enter, Escape
 * restores the stored value.
 *
 * Both goals and the savings account live in ONE row with one version, so
 * each save sends the other fields exactly as the server last returned them;
 * the optimistic lock turns a race between the two fields into a visible
 * «alguien cambió esto» instead of one silently undoing the other.
 */
export function MetaInline({
  campo,
  etiqueta,
  configuracion,
  puedeConfigurar,
}: {
  campo: "metaAsignacionCasa" | "metaAhorro";
  etiqueta: string;
  configuracion: Config;
  puedeConfigurar: boolean;
}) {
  const guardado = configuracion[campo];
  const inicial = guardado === null ? "" : formatMoney(guardado);
  const [valor, setValor] = useState(inicial);
  const [base, setBase] = useState(inicial);
  const accion = useAccion();
  const errorId = useId();
  // Fresh server data (after any save or a newer version) replaces the draft.
  if (base !== inicial) {
    setBase(inicial);
    setValor(inicial);
  }

  const guardar = () => {
    if (valor.trim() === inicial.trim()) return;
    accion.ejecutar(() =>
      editarConfiguracionAction({
        version: configuracion.version,
        metaAsignacionCasa: campo === "metaAsignacionCasa" ? valor : montoEntrada(configuracion.metaAsignacionCasa),
        metaAhorro: campo === "metaAhorro" ? valor : montoEntrada(configuracion.metaAhorro),
        cuentaAhorroId: configuracion.cuentaAhorroId ?? "",
      }),
    );
  };

  if (!puedeConfigurar) {
    // Read-only viewer: the figure as text, never a field that looks editable.
    return (
      <span className={r.metaLabel}>
        {etiqueta}
        <span className={r.metaValue}>{inicial || "—"}</span>
      </span>
    );
  }

  return (
    <label className={r.metaLabel}>
      {etiqueta}
      <input
        className={r.metaInput}
        inputMode="decimal"
        value={valor}
        placeholder="$ 0"
        aria-invalid={accion.error ? true : undefined}
        aria-describedby={accion.error ? errorId : undefined}
        aria-busy={accion.pendiente || undefined}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setValor(inicial);
        }}
      />
      {accion.error ? (
        <span id={errorId} role="alert" className={r.inlineError}>
          {accion.error}
        </span>
      ) : null}
    </label>
  );
}
