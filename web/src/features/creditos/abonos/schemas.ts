/**
 * Input schemas for extraordinary principal prepayments (abonos a capital)
 * and their reversal. Messages reproduce the ones the actions used before zod
 * so the forms keep saying the same thing for the same mistake.
 */
import { z } from "zod";

import {
  entityId,
  moneyInput,
  operationKey,
  optionalText,
  pastOrTodayDateInput,
  rowVersion,
  todayInBogota,
} from "@/server/validation/input";

/** FormData fields read by `registrarAbonoCapital`. */
export const REGISTRAR_ABONO_FIELDS = [
  "creditoId",
  "montoAbono",
  "fechaAbono",
  "creditoVersion",
  "idempotencyKey",
] as const;

export const registrarAbonoSchema = z.object({
  creditoId: entityId("creditoId"),
  montoAbono: moneyInput({
    required: "Falta el campo obligatorio montoAbono.",
    invalid: "Ingresa un monto de abono válido mayor a cero.",
  }),
  // A blank date historically meant "today in Bogota"; keep that default.
  fechaAbono: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : undefined),
    pastOrTodayDateInput("la fecha del abono", "La fecha del abono no puede estar en el futuro.").optional(),
  ).transform((date) => date ?? todayInBogota()),
  // Version of the credit the person saw; the abono is computed against that
  // balance, so a newer credit (another payment, abono or extension) must win.
  creditoVersion: rowVersion,
  // One key per logical abono, reused on double click / network retry.
  idempotencyKey: operationKey,
});

export type RegistrarAbonoInput = z.output<typeof registrarAbonoSchema>;

/** FormData fields read by `reversarAbonoCapital`. */
export const REVERSAR_ABONO_FIELDS = ["creditoId", "abonoEventoId", "motivo"] as const;

export const reversarAbonoSchema = z.object({
  creditoId: entityId("creditoId"),
  abonoEventoId: entityId("abonoEventoId"),
  motivo: optionalText({ max: 500, tooLong: "El motivo no puede superar 500 caracteres." }),
});
