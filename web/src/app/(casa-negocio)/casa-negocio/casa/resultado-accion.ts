/**
 * Result of the Casa y Negocio Server Actions, and the one place that turns a
 * service failure into what the form shows.
 *
 * The services throw (zod `InputValidationError`, `CasaNegocioReglaError`,
 * `CasaNegocioPermisoError`, `ConcurrentModificationError`); an action never
 * lets those reach the client as an exception, because Next.js replaces the
 * message of a thrown server error with a digest in production. Instead it
 * returns this plain union: `campos` marks each field (zod issues, or the
 * field a business rule names), `mensaje` is the line under the button.
 * Anything else is unexpected: logged on the server, generic text out.
 *
 * Plain module (no "use server"), so tests and both tabs' actions share it.
 */
import { logEvent } from "@/server/observability/log";
import { ConcurrentModificationError } from "@/server/optimistic-lock";
import { CasaNegocioPermisoError, CasaNegocioReglaError } from "@/server/casa-negocio/errors";
import { InputValidationError, type FieldErrors } from "@/server/validation/input";

export type ResultadoAccion<T = undefined> =
  | { ok: true; mensaje: string; datos: T }
  | { ok: false; mensaje: string; campos: FieldErrors; conflicto: boolean };

export const MENSAJE_INESPERADO = "No se pudo guardar. Inténtalo de nuevo en un momento.";

export function fallo(error: unknown): ResultadoAccion<never> {
  if (error instanceof InputValidationError) {
    return { ok: false, mensaje: "Revisa los campos marcados.", campos: error.fieldErrors, conflicto: false };
  }
  if (error instanceof CasaNegocioReglaError) {
    return { ok: false, mensaje: error.message, campos: error.field ? { [error.field]: error.message } : {}, conflicto: false };
  }
  if (error instanceof CasaNegocioPermisoError) {
    return { ok: false, mensaje: error.message, campos: {}, conflicto: false };
  }
  if (error instanceof ConcurrentModificationError) {
    return { ok: false, mensaje: error.message, campos: {}, conflicto: true };
  }
  logEvent("error", "casa_negocio.accion_fallida", {}, error);
  return { ok: false, mensaje: MENSAJE_INESPERADO, campos: {}, conflicto: false };
}

/** Runs a service, revalidates on success and maps any failure with `fallo`. */
export async function ejecutar<T>(
  servicio: () => Promise<T>,
  exito: (resultado: T) => string,
  revalidar: () => void,
): Promise<ResultadoAccion<T>> {
  try {
    const datos = await servicio();
    revalidar();
    return { ok: true, mensaje: exito(datos), datos };
  } catch (error) {
    return fallo(error);
  }
}
