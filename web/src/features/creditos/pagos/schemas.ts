/**
 * Input schemas for installment payments, their reversal, the real payment
 * date correction and the per-credit overdue refresh.
 */
import { z } from "zod";

import { entityId, pastOrTodayDateInput } from "@/server/validation/input";

/** Fields of `registrarPagoCuota` and `reversarPagoCuota`. */
export const CUOTA_FIELDS = ["eventoId", "creditoId"] as const;

export const cuotaSchema = z.object({
  eventoId: entityId("eventoId"),
  creditoId: entityId("creditoId"),
});

/** Fields of `actualizarFechaPagoCuota`. */
export const FECHA_PAGO_FIELDS = ["eventoId", "creditoId", "fechaPago"] as const;

export const actualizarFechaPagoSchema = cuotaSchema.extend({
  fechaPago: pastOrTodayDateInput("la fecha real de pago", "La fecha real de pago no puede estar en el futuro."),
});

/** Fields of `actualizarCuotasVencidasCredito`. */
export const CREDITO_FIELDS = ["creditoId"] as const;

export const creditoIdSchema = z.object({
  creditoId: entityId("creditoId"),
});
