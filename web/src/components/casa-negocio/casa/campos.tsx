"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import { cnFormRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { FieldErrors } from "@/server/validation/input";

import type { ResultadoAccion } from "@/app/(casa-negocio)/casa-negocio/casa/resultado-accion";
import { formatearMonto, normalizarPegado } from "./formas";

/**
 * Client plumbing shared by the Casa and Negocio forms: labelled fields with
 * their error, the money field, and `useEnvio`, the submit hook that blocks a
 * double send, keeps one idempotency key per logical submission and moves
 * the focus to the first field the server rejected.
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
          // Digits keypad on phones: pesos are whole numbers in practice and
          // the «.» grouping is typed by `formatearMonto`, not by the person.
          inputMode="numeric"
          autoComplete="off"
          placeholder="$ 0"
          className={cnFormRecipes.amount}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(formatearMonto(e.target.value))}
          onPaste={(e) => {
            // A paste that replaces the whole value is read by shape
            // (`normalizarPegado`), so «1,787,000» from a bank SMS is not
            // taken as one peso with decimals. A paste into the middle of
            // a typed value keeps the browser's insertion and the typing rule.
            const campo = e.currentTarget;
            const todo = campo.value === "" || (campo.selectionStart === 0 && campo.selectionEnd === campo.value.length);
            if (!todo) return;
            e.preventDefault();
            onChange(normalizarPegado(e.clipboardData.getData("text")));
          }}
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
  /** Bumped on every answer, so the same error twice still moves the focus. */
  serie: number;
}

const SIN_ESTADO: EstadoEnvio = { mensaje: null, ok: false, campos: {}, serie: 0 };

/**
 * Focuses the first control the server marked (`aria-invalid="true"`, set
 * by `Campo`) inside `raiz`, in document order, which is the order the
 * person reads the form. Returns whether one was found. Typed against the
 * two DOM methods it needs so tests can pass a stand-in.
 */
export function enfocarPrimerError(raiz: Pick<ParentNode, "querySelector"> | null): boolean {
  const campo = raiz?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!campo) return false;
  campo.focus();
  return true;
}

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
  /** Attach to the `<form>`: field errors are looked up inside it. */
  const formRef = useRef<HTMLFormElement>(null);

  // After the fields re-render with `aria-invalid`, jump to the first one:
  // the screen reader then reads its label and, through
  // `aria-describedby`, the error, and the person can correct it at once.
  // The typed values are untouched (only a success clears the form).
  useEffect(() => {
    if (estado.serie === 0 || estado.ok) return;
    if (Object.values(estado.campos).some(Boolean)) enfocarPrimerError(formRef.current);
  }, [estado]);

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
            setEstado((e) => ({ mensaje: r.mensaje, ok: true, campos: {}, serie: e.serie + 1 }));
            alExito?.(r.datos);
          } else {
            setEstado((e) => ({ mensaje: r.mensaje, ok: false, campos: r.campos, serie: e.serie + 1 }));
          }
        } catch {
          setEstado((e) => ({ mensaje: "No se pudo conectar. Inténtalo de nuevo.", ok: false, campos: {}, serie: e.serie + 1 }));
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

  return { pendiente, estado, enviar, limpiarCampo, formRef, reiniciar: () => setEstado(SIN_ESTADO) };
}

/**
 * The line next to the submit button. Two live regions stay mounted so
 * screen readers register them before anything is said: a success is
 * announced politely (green, «Anotado.»), a failure assertively (red), and
 * the failure also starts with a hidden «Error:» so the colour is never
 * the only signal.
 */
export function EstadoLinea({ estado }: { estado: EstadoEnvio }) {
  const error = !estado.ok && estado.mensaje ? estado.mensaje : "";
  return (
    <>
      <span role="status" className={estado.ok ? cnFormRecipes.status : "sr-only"}>
        {estado.ok ? (estado.mensaje ?? "") : ""}
      </span>
      <span role="alert" className={error ? cnFormRecipes.statusError : "sr-only"}>
        {error ? <span className="sr-only">Error: </span> : null}
        {error}
      </span>
    </>
  );
}
