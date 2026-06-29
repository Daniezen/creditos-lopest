"use server";

import { revalidatePath } from "next/cache";
import {
  EstadoCredito,
  EstadoEventoFinanciero,
  FrecuenciaPago,
  TipoAmortizacion,
  TipoEventoFinanciero,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

function toMoneyDecimalString(value: number): string {
  return value.toFixed(2);
}

function obtenerHoyColombia(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(year, month - 1, day);
}

function leerCampoObligatorio(formData: FormData, name: string): string {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta el campo obligatorio ${name}.`);
  }

  return value.trim();
}

/**
 * Regla legacy de Sheets para extensión de plazo:
 * - Mensual: sumar 1 mes.
 * - Quincenal: sumar 15 días.
 *
 * Nota:
 * Esto replica comportamiento operativo de Sheets. No recalcula calendario 5/20,
 * 10/25 o 15/30 en esta fase para evitar cambiar reglas financieras ya usadas.
 */
function calcularSiguienteFechaLegacy(fecha: Date, frecuencia: FrecuenciaPago): Date {
  const siguiente = new Date(fecha);

  if (frecuencia === FrecuenciaPago.MENSUAL) {
    siguiente.setMonth(siguiente.getMonth() + 1);
    return siguiente;
  }

  siguiente.setDate(siguiente.getDate() + 15);
  return siguiente;
}

function estadoInicialPorFecha(fechaProgramada: Date, hoy: Date): EstadoEventoFinanciero {
  return fechaProgramada.getTime() < hoy.getTime()
    ? EstadoEventoFinanciero.ATRASADO
    : EstadoEventoFinanciero.PENDIENTE;
}

/**
 * Extiende plazo de crédito SOLO_INTERES.
 *
 * Comportamiento heredado:
 * 1. Busca la última cuota programada no cancelada por abono.
 * 2. Mueve el capital de esa última cuota a nuevas cuotas futuras.
 * 3. La cuota final anterior queda solo con interés.
 * 4. La última cuota nueva conserva el capital.
 */
export async function extenderPlazoSoloInteres(formData: FormData): Promise<void> {
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const cuotasExtraRaw = leerCampoObligatorio(formData, "cuotasExtra");
  const cuotasExtra = Number(cuotasExtraRaw);
  const hoy = obtenerHoyColombia();

  if (!Number.isInteger(cuotasExtra) || cuotasExtra <= 0 || cuotasExtra > 60) {
    throw new Error("Ingresa un número entero de cuotas extra entre 1 y 60.");
  }

  await prisma.$transaction(async (tx) => {
    const credito = await tx.credito.findUnique({
      where: {
        id: creditoId,
      },
      include: {
        cliente: {
          select: {
            nombre: true,
            cedula: true,
          },
        },
        eventos: {
          where: {
            tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
            estado: {
              not: EstadoEventoFinanciero.CANCELADO_POR_ABONO,
            },
          },
          orderBy: [
            {
              numeroCuota: "asc",
            },
            {
              creadoEn: "asc",
            },
          ],
        },
      },
    });

    if (!credito) {
      throw new Error("El crédito no existe.");
    }

    if (credito.estado === EstadoCredito.CANCELADO) {
      throw new Error("No se puede extender un crédito cancelado.");
    }

    if (credito.tipoAmortizacion !== TipoAmortizacion.SOLO_INTERES) {
      throw new Error("Extender plazo solo aplica para créditos de Solo Interés.");
    }

    const cuotas = credito.eventos.filter((evento) => evento.numeroCuota !== null);

    if (cuotas.length === 0) {
      throw new Error("El crédito no tiene cuotas programadas para extender.");
    }

    const ultimaCuota = [...cuotas].sort(
      (a, b) => Number(b.numeroCuota ?? 0) - Number(a.numeroCuota ?? 0),
    )[0];

    const capitalFinal = Number(ultimaCuota.capitalProgramado || 0);
    const interesBase = Number(ultimaCuota.interesProgramado || 0);

    if (capitalFinal <= 0) {
      throw new Error("La última cuota no tiene capital pendiente para extender.");
    }

    await tx.eventoFinanciero.update({
      where: {
        id: ultimaCuota.id,
      },
      data: {
        capitalProgramado: "0.00",
        valorProgramado: toMoneyDecimalString(interesBase),
        saldoCapitalPost: toMoneyDecimalString(capitalFinal),
        accionPor: "sistema",
      },
    });

    const maxNumeroCuota = Math.max(
      ...cuotas.map((cuota) => Number(cuota.numeroCuota ?? 0)),
    );

    let fechaIterativa = new Date(ultimaCuota.fechaProgramada);
    const nuevasCuotas = [];

    for (let index = 1; index <= cuotasExtra; index++) {
      fechaIterativa = calcularSiguienteFechaLegacy(
        fechaIterativa,
        credito.frecuencia,
      );

      const numeroCuota = maxNumeroCuota + index;
      const esUltimaNueva = index === cuotasExtra;
      const capitalProgramado = esUltimaNueva ? capitalFinal : 0;
      const valorProgramado = interesBase + capitalProgramado;
      const saldoCapitalPost = esUltimaNueva ? 0 : capitalFinal;

      nuevasCuotas.push({
        codigo: `${credito.codigo}-C${numeroCuota}`,
        creditoId: credito.id,
        numeroCuota,
        tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
        fechaProgramada: new Date(fechaIterativa),
        fechaPago: null,
        valorProgramado: toMoneyDecimalString(valorProgramado),
        capitalProgramado: toMoneyDecimalString(capitalProgramado),
        interesProgramado: toMoneyDecimalString(interesBase),
        montoPagado: "0.00",
        capitalPagado: "0.00",
        interesPagado: "0.00",
        saldoCapitalPost: toMoneyDecimalString(saldoCapitalPost),
        estado: estadoInicialPorFecha(fechaIterativa, hoy),
        diasAtraso: 0,
        accionPor: "sistema",
      });
    }

    await tx.eventoFinanciero.createMany({
      data: nuevasCuotas,
    });

    await tx.credito.update({
      where: {
        id: credito.id,
      },
      data: {
        plazoMeses: credito.plazoMeses,
        estado: EstadoCredito.ACTIVO,
        fechaCancelacion: null,
        accionPor: "sistema",
      },
    });
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}
