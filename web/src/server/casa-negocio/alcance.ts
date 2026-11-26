/**
 * Loan scope of Casa y Negocio: the whole family business, whoever looks.
 *
 * WHY NOT THE APP'S OWNER SCOPE. Créditos, Clientes and Reportes show an
 * OPERADOR only the loans they own (`@/server/auth/scope`). This module
 * answers a different question: how much the family's business earned and
 * where the money is. A profit that left out the mother's credits would be
 * wrong for the father, who manages all the money (decided by the user on
 * 2026-11-26). So every loan-derived read here, and assigning an account to
 * a cobro or disbursement (a module-only fact stored apart, never on the loan
 * rows), covers every non-deleted loan. Access to the module itself is still
 * gated by the `casa_negocio.*` capabilities, and each row keeps its owner
 * (`dueno`, `esPropio`) so the UI marks loans that are not the viewer's.
 *
 * What changes a loan (castigo, payments, edits) keeps the owner scope:
 * that belongs to Créditos.
 */
import type { Prisma } from "@prisma/client";

/** Every loan of the business that was not soft-deleted. */
export const CREDITO_DEL_MODULO: Prisma.CreditoWhereInput = { eliminadoEn: null };

/** Every financial event whose loan was not soft-deleted. */
export const EVENTO_DEL_MODULO: Prisma.EventoFinancieroWhereInput = { credito: CREDITO_DEL_MODULO };
