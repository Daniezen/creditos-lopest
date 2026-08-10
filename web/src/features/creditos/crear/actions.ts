"use server";

import { revalidatePath } from "next/cache";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireClienteAccess } from "@/server/auth/scope";

import { reservarCodigoCredito } from "../codigos";
import { esPosibleDuplicado } from "../deletion-policy";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import {
  mapEstadoCuotaToPrisma,
  mapFrecuenciaPagoToPrisma,
  mapTipoAmortizacionToPrisma,
  normalizarCondicionesCredito,
  toMoneyDecimalString,
  toRateDecimalString,
  toTermDecimalString,
} from "./mappers";

import type { SimulatorFormState } from "@/features/simulador-creditos/types";

interface CrearCreditoDesdeWizardInput {
  clienteId: string;
  form: SimulatorFormState;
  nota?: string;
  idempotencyKey: string;
  confirmarPosibleDuplicado?: boolean;
  motivoDuplicado?: string;
}

type CrearCreditoDesdeWizardResult =
  | {
      ok: true;
      creditoId: string;
      codigo: string;
    }
  | {
      ok: false;
      error: string;
      possibleDuplicates?: Array<{
        codigo: string;
        monto: number;
        fechaPrestamo: string;
        ownerNombre: string | null;
        ownerEmail: string | null;
      }>;
    };

/**
 * Crea un crédito real desde el wizard.
 *
 * Seguridad:
 * - valida ownership/ADMIN sobre el cliente antes de crear el crédito;
 * - impide que un usuario cree créditos sobre clientes ajenos;
 * - mantiene idempotencyKey para doble submit, pero valida que coincida con
 *   el mismo cliente solicitado.
 */
export async function crearCreditoDesdeWizard(
  input: CrearCreditoDesdeWizardInput,
): Promise<CrearCreditoDesdeWizardResult> {
  const clienteId = input.clienteId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  const nota = input.nota?.trim() || null;

  if (nota && nota.length > 1000) {
    return { ok: false, error: "La nota no puede superar 1000 caracteres." };
  }

  if (!clienteId) {
    return {
      ok: false,
      error: "Selecciona un cliente antes de guardar.",
    };
  }

  if (!idempotencyKey) {
    return {
      ok: false,
      error: "No se pudo identificar la operación. Reinicia el flujo e inténtalo de nuevo.",
    };
  }

  try {
    const { user } = await requireClienteAccess(clienteId);
    assertCanMutate(user);

    const condiciones = normalizarCondicionesCredito(input.form);

    const resultado = await prisma.$transaction(async (tx) => {
      const creditoExistente = await tx.credito.findUnique({
        where: {
          idempotencyKey,
        },
        select: {
          id: true,
          codigo: true,
          clienteId: true,
          ownerUserId: true,
          eliminadoEn: true,
        },
      });

      if (creditoExistente) {
        if (creditoExistente.eliminadoEn) {
          throw new Error(
            "La operación anterior corresponde a un crédito eliminado. Reinicia el flujo para generar una nueva operación.",
          );
        }

        if (creditoExistente.clienteId !== clienteId) {
          throw new Error("La operación idempotente no corresponde al cliente seleccionado.");
        }

        if (!creditoExistente.ownerUserId) {
          await tx.credito.update({
            where: {
              id: creditoExistente.id,
            },
            data: {
              ownerUserId: user.id,
              accionPor: user.id,
            },
          });
        }

        return {
          id: creditoExistente.id,
          codigo: creditoExistente.codigo,
        };
      }

      const cliente = await tx.cliente.findUnique({
        where: {
          id: clienteId,
        },
        select: {
          id: true,
          nombre: true,
          cedula: true,
        },
      });

      if (!cliente) {
        throw new Error("El cliente seleccionado no existe.");
      }

      const existentes = await tx.credito.findMany({
        where: { clienteId, eliminadoEn: null },
        include: { ownerUser: { select: { nombre: true, email: true } } },
      });
      const posiblesDuplicados = existentes.filter((existente) => esPosibleDuplicado({
        fechaPrestamo: condiciones.fechaPrestamo,
        tasaMensual: condiciones.tasaMensual,
        frecuencia: mapFrecuenciaPagoToPrisma(condiciones.frecuencia),
        tipoAmortizacion: mapTipoAmortizacionToPrisma(condiciones.tipoAmortizacion),
        monto: condiciones.monto,
      }, existente));
      if (posiblesDuplicados.length > 0 && !input.confirmarPosibleDuplicado) {
        const error = new Error("POSIBLE_DUPLICADO");
        Object.assign(error, { posiblesDuplicados });
        throw error;
      }
      const motivoDuplicado = input.motivoDuplicado?.trim() ?? "";
      if (posiblesDuplicados.length > 0 && motivoDuplicado.length < 10) {
        throw new Error("Indica por qué el nuevo crédito es diferente del existente.");
      }

      const cronograma = generarCronogramaSimulado({
        fechaPrestamo: condiciones.fechaPrestamo,
        monto: condiciones.monto,
        plazoMeses: condiciones.plazoMeses,
        tasaMensual: condiciones.tasaMensual,
        frecuencia: condiciones.frecuencia,
        tipoAmortizacion: condiciones.tipoAmortizacion,
        cliente: cliente.nombre,
        cedula: cliente.cedula,
        fechaReferencia: new Date(),
      });

      if (cronograma.length === 0) {
        throw new Error("No se generó cronograma para el crédito.");
      }

      const codigo = await reservarCodigoCredito(tx, condiciones.fechaPrestamo);

      const credito = await tx.credito.create({
        data: {
          codigo,
          idempotencyKey,

          clienteId: cliente.id,
          fechaPrestamo: condiciones.fechaPrestamo,

          monto: toMoneyDecimalString(condiciones.monto),
          plazoMeses: toTermDecimalString(condiciones.plazoMeses),
          tasaMensual: toRateDecimalString(condiciones.tasaMensual),

          frecuencia: mapFrecuenciaPagoToPrisma(condiciones.frecuencia),
          tipoAmortizacion: mapTipoAmortizacionToPrisma(
            condiciones.tipoAmortizacion,
          ),

          ownerUserId: user.id,
          nota,
          accionPor: user.id,
        },
        select: {
          id: true,
          codigo: true,
        },
      });

      if (posiblesDuplicados.length > 0) {
        await recordAuditLogTx(tx, {
          actorId: user.id,
          action: "CREDITO_CREATE_DUPLICATE_OVERRIDE",
          entityType: "Credito",
          entityId: credito.id,
          reason: motivoDuplicado,
          after: { codigo: credito.codigo, clienteId },
          metadata: { possibleDuplicateIds: posiblesDuplicados.map((item) => item.id) },
        });
      }
      await tx.eventoFinanciero.createMany({
        data: cronograma.map((cuota) => ({
          codigo: `${codigo}-C${cuota.numeroCuota}`,
          creditoId: credito.id,
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

      return credito;
    });

    revalidatePath("/creditos");
    revalidatePath(`/creditos/${resultado.id}`);

    return {
      ok: true,
      creditoId: resultado.id,
      codigo: resultado.codigo,
    };
  } catch (error) {
    console.error("Error al crear crédito desde wizard:", error);
    const possibleDuplicates = error && typeof error === "object" && "posiblesDuplicados" in error
      ? (error.posiblesDuplicados as Array<{ codigo: string; monto: unknown; fechaPrestamo: Date; ownerUser: { nombre: string; email: string } | null }>).map((item) => ({
          codigo: item.codigo,
          monto: Number(item.monto),
          fechaPrestamo: item.fechaPrestamo.toISOString(),
          ownerNombre: item.ownerUser?.nombre ?? null,
          ownerEmail: item.ownerUser?.email ?? null,
        }))
      : undefined;
    return {
      ok: false,
      error: possibleDuplicates
        ? "Se encontraron créditos posiblemente duplicados."
        : error instanceof Error
          ? error.message
          : "No se pudo guardar el crédito.",
      possibleDuplicates,
    };
  }
}
