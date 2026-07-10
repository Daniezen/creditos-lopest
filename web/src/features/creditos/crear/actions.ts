"use server";

import { revalidatePath } from "next/cache";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireClienteAccess } from "@/server/auth/scope";

import { reservarCodigoCredito } from "../codigos";
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
  idempotencyKey: string;
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
        },
      });

      if (creditoExistente) {
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
          accionPor: user.id,
        },
        select: {
          id: true,
          codigo: true,
        },
      });

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

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el crédito.",
    };
  }
}
