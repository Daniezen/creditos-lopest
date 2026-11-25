"use server";

import { revalidatePath } from "next/cache";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { prisma } from "@/lib/prisma";
import { eventoTieneActividadFinanciera } from "@/features/creditos/financial-activity";
import { puedeBorrarseCredito } from "@/features/creditos/deletion-policy";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { assertVersionClaimed, updatedAtMatches } from "@/server/optimistic-lock";
import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";
import { fieldErrorsOf, parseInput, type FieldErrors } from "@/server/validation/input";
import type { z } from "zod";

import {
  mapEstadoCuotaToPrisma,
  mapFrecuenciaPagoToPrisma,
  mapTipoAmortizacionToPrisma,
  normalizarCondicionesCredito,
  toMoneyDecimalString,
  toRateDecimalString,
  toTermDecimalString,
} from "../crear/mappers";

import type { SimulatorFormState } from "@/features/simulador-creditos/types";

import { actualizarCreditoSchema, eliminarCreditoSchema } from "./schemas";

interface ActualizarCreditoInput {
  id: string;
  form: SimulatorFormState;
  nota?: string;
  /** `actualizadoEn.toISOString()` the edit screen loaded (optimistic lock). */
  version: string;
}

interface EliminarCreditoInput {
  id: string;
  motivo: string;
}

type CreditMutationResult =
  | {
      ok: true;
      creditoId?: string;
      modo?: "REGENERADO" | "NOTAS_ACTUALIZADAS" | "ELIMINADO";
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: FieldErrors;
    };

/** Result for a payload that failed its schema, before any I/O. */
function invalidInput(error: unknown): CreditMutationResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Los datos del crédito no son válidos.",
    fieldErrors: fieldErrorsOf(error),
  };
}

function eventoPuedeRegenerarse(evento: {
  tipo: string;
  estado: string;
  montoPagado: unknown;
  capitalPagado: unknown;
  interesPagado: unknown;
  fechaPago: Date | null;
}): boolean {
  return !eventoTieneActividadFinanciera(evento);
}

export async function actualizarCredito(
  input: ActualizarCreditoInput,
): Promise<CreditMutationResult> {
  let parsed: z.output<typeof actualizarCreditoSchema>;
  try {
    parsed = parseInput(actualizarCreditoSchema, input);
  } catch (error) {
    return invalidInput(error);
  }
  const { id, nota, version } = parsed;

  try {
    const { user } = await requireCreditoAccess(id);
    assertCanMutate(user);

    const result = await prisma.$transaction(async (tx) => {
      // Optimistic lock: claim the version the screen loaded before reading
      // anything. A concurrent edit, payment, abono or extension has moved
      // `actualizadoEn`, so the claim matches nothing and the edit aborts
      // instead of regenerating the schedule from stale conditions.
      const claimed = await tx.credito.updateMany({
        where: { id, actualizadoEn: updatedAtMatches(version) },
        data: { accionPor: user.id },
      });
      assertVersionClaimed(claimed.count);

      const credito = await tx.credito.findUnique({
        where: {
          id,
        },
        include: {
          cliente: {
            select: {
              nombre: true,
              cedula: true,
            },
          },
          eventos: {
            select: {
              id: true,
              numeroCuota: true,
              tipo: true,
              estado: true,
              montoPagado: true,
              capitalPagado: true,
              interesPagado: true,
              fechaPago: true,
            },
          },
        },
      });

      if (!credito) {
        throw new Error("El crédito no existe.");
      }

      const tieneActividad = credito.eventos.some(eventoTieneActividadFinanciera);

      if (tieneActividad) {
        await tx.credito.update({
          where: {
            id,
          },
          data: {
            nota,
            accionPor: user.id,
          },
        });

        return {
          modo: "NOTAS_ACTUALIZADAS" as const,
        };
      }

      const condiciones = normalizarCondicionesCredito(parsed.form);

      const cronograma = generarCronogramaSimulado({
        fechaPrestamo: condiciones.fechaPrestamo,
        monto: condiciones.monto,
        plazoMeses: condiciones.plazoMeses,
        tasaMensual: condiciones.tasaMensual,
        frecuencia: condiciones.frecuencia,
        tipoAmortizacion: condiciones.tipoAmortizacion,
        cliente: credito.cliente.nombre,
        cedula: credito.cliente.cedula,
        fechaReferencia: new Date(),
      });

      const eventosRegenerables = credito.eventos.filter(eventoPuedeRegenerarse);

      await tx.eventoFinanciero.deleteMany({
        where: {
          id: {
            in: eventosRegenerables.map((evento) => evento.id),
          },
        },
      });

      await tx.credito.update({
        where: {
          id,
        },
        data: {
          fechaPrestamo: condiciones.fechaPrestamo,
          monto: toMoneyDecimalString(condiciones.monto),
          plazoMeses: toTermDecimalString(condiciones.plazoMeses),
          tasaMensual: toRateDecimalString(condiciones.tasaMensual),
          frecuencia: mapFrecuenciaPagoToPrisma(condiciones.frecuencia),
          tipoAmortizacion: mapTipoAmortizacionToPrisma(
            condiciones.tipoAmortizacion,
          ),
          nota,
          accionPor: user.id,
        },
      });

      const codigosBloqueados = new Set(
        credito.eventos
          .filter((evento) => !eventoPuedeRegenerarse(evento))
          .map((evento) =>
            evento.numeroCuota ? `${credito.codigo}-C${evento.numeroCuota}` : null,
          )
          .filter((codigo): codigo is string => codigo !== null),
      );

      await tx.eventoFinanciero.createMany({
        data: cronograma
          .filter((cuota) => !codigosBloqueados.has(`${credito.codigo}-C${cuota.numeroCuota}`))
          .map((cuota) => ({
            codigo: `${credito.codigo}-C${cuota.numeroCuota}`,
            creditoId: id,
            numeroCuota: cuota.numeroCuota,
            tipo: "CUOTA_PROGRAMADA",
            fechaProgramada: cuota.fechaProgramada,
            valorProgramado: toMoneyDecimalString(cuota.valorCuota),
            capitalProgramado: toMoneyDecimalString(cuota.capitalProgramado),
            interesProgramado: toMoneyDecimalString(cuota.interesProgramado),
            saldoCapitalPost: toMoneyDecimalString(cuota.saldoCapitalPost),
            estado: mapEstadoCuotaToPrisma(cuota.estado),
            accionPor: user.id,
          })),
      });

      return {
        modo: "REGENERADO" as const,
      };
    });

    revalidatePath("/creditos");
    revalidatePath(`/creditos/${id}`);

    return {
      ok: true,
      creditoId: id,
      modo: result.modo,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el crédito.",
    };
  }
}

export async function eliminarCredito(
  input: EliminarCreditoInput,
): Promise<CreditMutationResult> {
  let parsed: z.output<typeof eliminarCreditoSchema>;
  try {
    parsed = parseInput(eliminarCreditoSchema, input);
  } catch (error) {
    return invalidInput(error);
  }
  const { id, motivo } = parsed;

  try {
    const { user } = await requireCreditoAccess(id);
    assertCanMutate(user);

    await prisma.$transaction(async (tx) => {
      const credito = await tx.credito.findUnique({
        where: {
          id,
        },
        include: {
          eventos: {
            select: {
              id: true,
              tipo: true,
              estado: true,
              montoPagado: true,
              capitalPagado: true,
              interesPagado: true,
              fechaPago: true,
            },
          },
        },
      });

      if (!credito) {
        throw new Error("El crédito no existe.");
      }

      if (!puedeBorrarseCredito(credito.eventos)) {
        throw new Error(
          "No se puede eliminar el crédito porque mantiene pagos o abonos activos. Reviértelos primero.",
        );
      }

      if (credito.eliminadoEn) {
        throw new Error("El crédito ya fue eliminado.");
      }

      const eliminadoEn = new Date();

      await recordAuditLogTx(tx, {
        actorId: user.id,
        action: "CREDITO_DELETE",
        entityType: "Credito",
        entityId: credito.id,
        reason: motivo,
        before: {
          codigo: credito.codigo,
          clienteId: credito.clienteId,
          ownerUserId: credito.ownerUserId,
          estado: credito.estado,
          monto: String(credito.monto),
          fechaPrestamo: credito.fechaPrestamo.toISOString(),
          eventos: credito.eventos.map((evento) => ({
            id: evento.id,
            tipo: evento.tipo,
            estado: evento.estado,
          })),
        },
        after: {
          eliminadoEn: eliminadoEn.toISOString(),
          eliminadoPor: user.id,
        },
      });

      await tx.credito.update({
        where: {
          id,
        },
        data: {
          eliminadoEn,
          eliminadoPor: user.id,
          motivoEliminacion: motivo,
          accionPor: user.id,
        },
      });
    });

    revalidatePath("/creditos");

    return {
      ok: true,
      modo: "ELIMINADO",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el crédito.",
    };
  }
}
