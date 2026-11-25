/**
 * Input schema shared by every owner transfer (admin screens and the
 * Transferencias module): which record, to whom, and an optional reason that
 * lands in the audit log.
 */
import { z } from "zod";

import { entityId, optionalText } from "@/server/validation/input";

const reason = optionalText({ max: 500, tooLong: "El motivo no puede superar 500 caracteres." });

export const TRANSFER_CREDITO_FIELDS = ["creditoId", "targetOwnerUserId", "reason"] as const;

export const transferirCreditoSchema = z.object({
  creditoId: entityId("creditoId"),
  targetOwnerUserId: entityId("targetOwnerUserId"),
  reason,
});

export const TRANSFER_CLIENTE_FIELDS = ["clienteId", "targetOwnerUserId", "reason"] as const;

export const transferirClienteSchema = z.object({
  clienteId: entityId("clienteId"),
  targetOwnerUserId: entityId("targetOwnerUserId"),
  reason,
});
