"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";

import { cnFormRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { FieldErrors } from "@/server/validation/input";

import type { ResultadoAccion } from "@/app/(casa-negocio)/casa-negocio/casa/resultado-accion";
import { formatearMonto } from "./formas";

/**
 * Client plumbing shared by the Casa and Negocio forms: labelled fields with
 * their error, the money field, and `useEnvio`, the submit hook that blocks a
 * double send and keeps one idempotency key per logical submission.
 */

interface CampoProps {
  label: string;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}

/** A labelled control; the error is tied to it with `aria-describedby`. */
export function Campo({ label, error, children }: CampoProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cnFormRecipes.field}>
      <label htmlFor={id}>{label}</label>
      {children({ id, ...(error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {}) })}
      {error ? (
        <span id={errorId} className={cnFormRecipes.fieldError}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function CampoMonto({
  value,
  onChange,
  error,
  disabled,
  label = "Monto",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Campo label={label} error={error}>
      {(props) => (
        <input
          {...props}
          name="monto"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="$ 0"
          className={cnFormRecipes.amount}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(formatearMonto(e.target.value))}
        />
      )}
    </Campo>
  );
}

export interface Opcion {
  value: string;
  label: string;
}

export function CampoSelect({
  label,
  name,
  value,
  onChange,
  opciones,
  error,
  disabled,
  vacio,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  opciones: readonly Opcion[];
  error?: string;
  disabled?: boolean;
  /** Text of an empty first option; omitted when a choice is always made. */
  vacio?: string;
}) {
  return (
    <Campo label={label} error={error}>
      {(props) => (
        <select {...props} name={name} className={cnFormRecipes.control} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {vacio !== undefined ? <option value="">{vacio}</option> : null}
          {opciones.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Campo>
  );
}

export function CampoFecha({
  value,
  onChange,
  max,
  min,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  max: string;
  min?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Campo label="Fecha" error={error}>
      {(props) => (
        <input
          {...props}
          name="fecha"
          type="date"
          className={cnFormRecipes.control}
          value={value}
          max={max}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Campo>
  );
}

export function CampoTexto({
  label,
  name,
  value,
  onChange,
  placeholder,
  sugerencias,
  error,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sugerencias?: readonly string[];
  error?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  return (
    <Campo label={label} error={error}>
      {(props) => (
        <>
          <input
            {...props}
            name={name}
            type="text"
            maxLength={500}
            className={cnFormRecipes.control}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            list={sugerencias ? listId : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {sugerencias ? (
            <datalist id={listId}>
              {sugerencias.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          ) : null}
        </>
      )}
    </Campo>
  );
}

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export interface EstadoEnvio {
  mensaje: string | null;
  ok: boolean;
  campos: FieldErrors;
}

const SIN_ESTADO: EstadoEnvio = { mensaje: null, ok: false, campos: {} };

/**
 * Submit hook: while a request is in flight `pendiente` is true (the button
 * is disabled) and a second call is ignored; the same `operationKey` is sent
 * on every retry of one submission and renewed only after a success, so a
 * double click or a retry after a timeout is recognised as a replay by the
 * service instead of booking the movement twice.
 */
export function useEnvio<T>() {
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<EstadoEnvio>(SIN_ESTADO);
  const clave = useRef<string>("");
  const enVuelo = useRef(false);

  const enviar = useCallback(
    (accion: (operationKey: string) => Promise<ResultadoAccion<T>>, alExito?: (datos: T) => void) => {
      if (enVuelo.current) return;
      enVuelo.current = true;
      if (!clave.current) clave.current = nuevaClave();
      const operationKey = clave.current;
      startTransition(async () => {
        try {
          const r = await accion(operationKey);
          if (r.ok) {
            clave.current = "";
            setEstado({ mensaje: r.mensaje, ok: true, campos: {} });
            alExito?.(r.datos);
          } else {
            setEstado({ mensaje: r.mensaje, ok: false, campos: r.campos });
          }
        } catch {
          setEstado({ mensaje: "No se pudo conectar. Inténtalo de nuevo.", ok: false, campos: {} });
        } finally {
          enVuelo.current = false;
        }
      });
    },
    [],
  );

  const limpiarCampo = useCallback((campo: string) => {
    setEstado((e) => (e.campos[campo] ? { ...e, campos: { ...e.campos, [campo]: "" } } : e));
  }, []);

  return { pendiente, estado, enviar, limpiarCampo, reiniciar: () => setEstado(SIN_ESTADO) };
}

/** The line next to the submit button: success in green, failure in red, announced politely. */
export function EstadoLinea({ estado }: { estado: EstadoEnvio }) {
  return (
    <span role="status" aria-live="polite" className={estado.ok ? cnFormRecipes.status : cnFormRecipes.statusError}>
      {estado.mensaje ?? ""}
    </span>
  );
}
