/**
 * Input schemas for creating, editing and deleting clients.
 *
 * Limits are generous on purpose: client data was imported from a legacy
 * sheet with no caps, and an edit form posts every field back, so a tight
 * limit on a field the person did not touch would block the whole edit. The
 * limits exist to keep pathological payloads out, not to police formatting.
 */
import { z } from "zod";

import { entityId, optionalText } from "@/server/validation/input";

const optionalField = optionalText({ max: 500, tooLong: "Uno de los campos supera 500 caracteres." });

export const crearClienteSchema = z.object({
  cedula: z
    .string({ error: "La cédula es obligatoria." })
    .trim()
    .min(1, "La cédula es obligatoria.")
    .max(64, "La cédula no puede superar 64 caracteres."),
  nombre: z
    .string({ error: "El nombre del cliente es obligatorio." })
    .trim()
    .min(1, "El nombre del cliente es obligatorio.")
    .max(200, "El nombre no puede superar 200 caracteres."),
  direccion: optionalField,
  empresa: optionalField,
  telefono: optionalField,
  recomienda: optionalField,
  contacto: optionalField,
  contacto2: optionalField,
});

const clienteId = z.string({ error: "Cliente inválido." }).trim().min(1, "Cliente inválido.").pipe(entityId("id"));

export const actualizarClienteSchema = crearClienteSchema.extend({
  id: clienteId,
  // The folder link is rendered as an anchor; only web URLs may be stored so
  // a `javascript:` value can never reach an href.
  carpetaAdjuntosUrl: optionalText({ max: 2048, tooLong: "El enlace de la carpeta es demasiado largo." }).refine(
    (value) => value === null || /^https?:\/\//i.test(value),
    { error: "El enlace de la carpeta debe empezar por http:// o https://." },
  ),
  // Absent keeps the historical default of the action.
  estadoDocumentos: z
    .enum(["FALTAN_DOCUMENTOS", "DOCUMENTOS_CARGADOS"], { error: "El estado de documentos no es válido." })
    .optional()
    .transform((value) => value ?? "FALTAN_DOCUMENTOS"),
});

export const eliminarClienteSchema = z.object({ id: clienteId });
