"use client";

import { useEffect, useId, useRef } from "react";

import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";

/**
 * Modal editor on a native <dialog>: focus trap, Escape and the inert page
 * come from the browser. Open while `abierto`; `onCerrar` runs on Escape,
 * backdrop click or the Cancelar button.
 */
export function Editor({
  abierto,
  titulo,
  onCerrar,
  onEnviar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  onEnviar: (datos: FormData) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (abierto && !dialog.open) dialog.showModal();
    if (!abierto && dialog.open) dialog.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      className={r.dialog}
      onClose={onCerrar}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (event.target === event.currentTarget) onCerrar();
      }}
    >
      {abierto ? (
        <form
          className={r.dialogForm}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onEnviar(new FormData(event.currentTarget));
          }}
        >
          <h3 id={tituloId} className={r.dialogTitle}>
            {titulo}
          </h3>
          {children}
        </form>
      ) : null}
    </dialog>
  );
}

/** Label + control + inline error. */
export function Campo({
  etiqueta,
  error,
  ancho,
  children,
}: {
  etiqueta: string;
  error?: string;
  ancho?: boolean;
  children: (props: { "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const errorId = useId();
  return (
    <label className={`${r.field} ${ancho ? r.fieldWide : ""}`}>
      {etiqueta}
      {children(error ? { "aria-invalid": true, "aria-describedby": errorId } : {})}
      {error ? (
        <span id={errorId} className={r.fieldError}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

/** Text of a FormData field ("" when absent). */
export function texto(datos: FormData, campo: string): string {
  const value = datos.get(campo);
  return typeof value === "string" ? value : "";
}
