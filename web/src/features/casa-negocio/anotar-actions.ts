"use server";

import { revalidatePath } from "next/cache";

import { requireCapacidad } from "@/server/casa-negocio/capacidades";
import { CasaNegocioPermisoError, CasaNegocioReglaError } from "@/server/casa-negocio/errors";
import { registrarMovimiento } from "@/server/casa-negocio/movimientos";
import { logEvent } from "@/server/observability/log";
import { InputValidationError, formFields, toFieldErrors } from "@/server/validation/input";

import {
  CAMPOS_ANOTAR,
  aRegistroMovimiento,
  anotarSchema,
  campoDelPanel,
  type AnotarEstado,
  type CampoAnotar,
} from "./anotar";

/** Every tab reads the same month data, so a save refreshes the whole module. */
const MODULO = "/casa-negocio";

/**
 * Server Action of «Anotar» (the header's quick entry), for the six kinds.
 *
 * Order, the same as every service of the module:
 *   1. capability `casa_negocio.anotar` on the server, before reading input
 *      (a read-only person never sees the button, but the action does not
 *      trust that);
 *   2. the panel's zod schema, so each message is returned next to its field;
 *   3. `registrarMovimiento`, which checks the capability again, parses with
 *      its own schema, applies the database rules in one transaction and
 *      writes the audit row. Its `operationKey` makes a double submit
 *      idempotent: the second request finds the first movement.
 * Then the module's routes are revalidated, so the header, the line and the
 * tab under it show the new movement on the same response.
 */
export async function anotarMovimientoAction(previo: AnotarEstado, formData: FormData): Promise<AnotarEstado> {
  const raw = formFields(formData, CAMPOS_ANOTAR);
  const fallo = (message: string | null, fieldErrors?: AnotarEstado["fieldErrors"]): AnotarEstado => ({
    status: "error",
    message,
    fieldErrors,
    guardados: previo.guardados,
  });

  try {
    await requireCapacidad("ANOTAR");

    const parsed = anotarSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error) as Partial<Record<CampoAnotar, string>>;
      // Errors about the hidden fields have no field to sit next to.
      const general = fieldErrors.tipo ?? fieldErrors.operationKey ?? null;
      delete fieldErrors.tipo;
      delete fieldErrors.operationKey;
      return fallo(general ?? "Revisa los campos marcados.", fieldErrors);
    }

    await registrarMovimiento(aRegistroMovimiento(parsed.data, raw));
    revalidatePath(MODULO, "layout");
    return { status: "ok", message: null, guardados: previo.guardados + 1 };
  } catch (error) {
    if (error instanceof CasaNegocioPermisoError) return fallo(error.message);
    if (error instanceof CasaNegocioReglaError) {
      const campo = campoDelPanel(raw.tipo, error.field);
      return campo ? fallo(null, { [campo]: error.message }) : fallo(error.message);
    }
    if (error instanceof InputValidationError) {
      // The service's schema refused something the panel's accepted: map its fields back.
      const fieldErrors: Partial<Record<CampoAnotar, string>> = {};
      let general: string | null = null;
      for (const [campo, mensaje] of Object.entries(error.fieldErrors)) {
        const propio = campoDelPanel(raw.tipo, campo);
        if (propio) fieldErrors[propio] ??= mensaje;
        else general ??= mensaje;
      }
      return fallo(general, fieldErrors);
    }
    // Redirects (session expired → /login) must keep propagating.
    if (isNextControlFlow(error)) throw error;
    logEvent("error", "casa_negocio.anotar_fallido", { tipo: raw.tipo }, error);
    return fallo("No se pudo guardar. Inténtalo de nuevo.");
  }
}

/** `redirect()` / `notFound()` throw errors carrying a NEXT_* digest that Next must handle. */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
