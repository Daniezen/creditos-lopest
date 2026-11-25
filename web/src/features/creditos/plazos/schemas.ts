/**
 * Input schemas for the Solo Interés term extension and its reversal.
 */
import { z } from "zod";

import { entityId, optionalText, rowVersion } from "@/server/validation/input";

const CUOTAS_EXTRA_MESSAGE = "Ingresa un número entero de cuotas extra entre 1 y 60.";

/** FormData fields read by `extenderPlazoSoloInteres`. */
export const EXTENDER_PLAZO_FIELDS = ["creditoId", "cuotasExtra", "creditoVersion"] as const;

export const extenderPlazoSchema = z.object({
  creditoId: entityId("creditoId"),
  // `Number("  3 ")` is 3, as before; "3.5", "0", "61" and "abc" are rejected.
  cuotasExtra: z
    .string({ error: "Falta el campo obligatorio cuotasExtra." })
    .trim()
    .min(1, "Falta el campo obligatorio cuotasExtra.")
    .transform(Number)
    .pipe(z.number({ error: CUOTAS_EXTRA_MESSAGE }).int(CUOTAS_EXTRA_MESSAGE).min(1, CUOTAS_EXTRA_MESSAGE).max(60, CUOTAS_EXTRA_MESSAGE)),
  creditoVersion: rowVersion,
});

/** FormData fields read by `reversarExtensionPlazo`. */
export const REVERSAR_EXTENSION_FIELDS = ["creditoId", "snapshotId", "motivo", "creditoVersion"] as const;

export const reversarExtensionSchema = z.object({
  creditoId: entityId("creditoId"),
  snapshotId: entityId("snapshotId"),
  motivo: optionalText({ max: 500, tooLong: "El motivo no puede superar 500 caracteres." }),
  creditoVersion: rowVersion,
});
