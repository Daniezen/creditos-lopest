"use server";

import { revalidatePath } from "next/cache";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";

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

interface ActualizarCreditoInput {
  id: string;
  form: SimulatorFormState;
  observaciones?: string;
  nota?: string;
  adminOverrideCode?: string;
}

interface EliminarCreditoInput {
  id: string;
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
    };

function eventoTieneActividadFinanciera(evento: {
  tipo: string;
  estado: string;
  montoPagado: unknown;
  capitalPagado: unknown;
  interesPagado: unknown;
  fechaPago: Date | null;
}): boolean {
  return (
    evento.tipo === "ABONO_CAPITAL" ||
    evento.estado === "PAGADO" ||
    evento.estado === "CANCELADO_POR_ABONO" ||
    Number(evento.montoPagado) > 0 ||
    Number(evento.capitalPagado) > 0 ||
    Number(evento.interesPagado) > 0 ||
    evento.fechaPago !== null
  );
}

function isAdminOverrideAutorizado(code: string | undefined): boolean {
  const expectedCode = process.env.CREDIT_ADMIN_OVERRIDE_CODE;

  if (!expectedCode) {
    return false;
  }

  return code?.trim() === expectedCode;
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
  const id = input.id.trim();

  if (!id) {
    return {
      ok: false,
      error: "Crédito inválido.",
    };
  }

  try {
    const { user } = await requireCreditoAccess(id);
    assertCanMutate(user);

    const result = await prisma.$transaction(async (tx) => {
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
      const adminOverrideAutorizado = isAdminOverrideAutorizado(
        input.adminOverrideCode,
      );

      if (tieneActividad && !adminOverrideAutorizado) {
        await tx.credito.update({
          where: {
            id,
          },
          data: {
            observaciones: input.observaciones?.trim() || null,
            nota: input.nota?.trim() || null,
            accionPor: user.id,
          },
        });

        return {
          modo: "NOTAS_ACTUALIZADAS" as const,
        };
      }

      const condiciones = normalizarCondicionesCredito(input.form);

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
          observaciones: input.observaciones?.trim() || null,
          nota: input.nota?.trim() || null,
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
            accionPor: adminOverrideAutorizado ? "admin_override" : user.id,
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
  const id = input.id.trim();

  if (!id) {
    return {
      ok: false,
      error: "Crédito inválido.",
    };
  }

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

      const tieneActividad = credito.eventos.some(eventoTieneActividadFinanciera);

      if (tieneActividad) {
        throw new Error(
          "No se puede eliminar el crédito porque tiene pagos, abonos o historial financiero.",
        );
      }

      await tx.credito.delete({
        where: {
          id,
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
