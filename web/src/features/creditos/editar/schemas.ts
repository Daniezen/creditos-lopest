/**
 * Input schemas for editing and soft-deleting a credit.
 */
import { z } from "zod";

import { condicionesCreditoSchema } from "@/features/creditos/crear/schemas";
import { entityId, optionalText, rowVersion } from "@/server/validation/input";

const creditoId = z
  .string({ error: "Crédito inválido." })
  .trim()
  .min(1, "Crédito inválido.")
  .pipe(entityId("id"));

export const actualizarCreditoSchema = z.object({
  id: creditoId,
  form: condicionesCreditoSchema,
  // Creation caps notes at 1000; edits accept up to 5000 so notes imported
  // from the legacy sheet, which had no cap, never block an edit.
  nota: optionalText({ max: 5000, tooLong: "La nota no puede superar 5000 caracteres." }),
  // `actualizadoEn` the edit screen loaded (optimistic lock).
  version: rowVersion,
});

export const eliminarCreditoSchema = z.object({
  id: creditoId,
  motivo: z
    .string({ error: "Indica un motivo de eliminación entre 10 y 500 caracteres." })
    .trim()
    .min(10, "Indica un motivo de eliminación entre 10 y 500 caracteres.")
    .max(500, "Indica un motivo de eliminación entre 10 y 500 caracteres."),
});
