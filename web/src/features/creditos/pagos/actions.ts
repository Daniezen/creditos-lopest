"use server";

import { revalidatePath } from "next/cache";
import {
  EstadoCredito,
  EstadoEventoFinanciero,
  TipoEventoFinanciero,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Día calendario actual en zona Colombia.
 *
 * Motivo:
 * - Los pagos y atrasos se evalúan por día calendario, no por instante UTC.
 * - El servidor puede estar en UTC u otra zona; usar America/Bogota evita
 *   marcar estados con un día corrido durante la noche.
 */
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

function normalizarFechaSinHora(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function calcularDiasAtraso(fechaProgramada: Date, fechaReferencia: Date): number {
  const programada = normalizarFechaSinHora(fechaProgramada);
  const referencia = normalizarFechaSinHora(fechaReferencia);
  const diffMs = referencia.getTime() - programada.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, dias);
}

function estadoPendientePorFecha(fechaProgramada: Date, fechaReferencia: Date) {
  return fechaProgramada.getTime() < fechaReferencia.getTime()
    ? EstadoEventoFinanciero.ATRASADO
    : EstadoEventoFinanciero.PENDIENTE;
}

function leerCampoObligatorio(formData: FormData, name: string): string {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta el campo obligatorio ${name}.`);
  }

  return value.trim();
}

async function sincronizarEstadoCredito(
  tx: Prisma.TransactionClient,
  creditoId: string,
): Promise<void> {
  const eventos = await tx.eventoFinanciero.findMany({
    where: {
      creditoId,
      tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
    },
    select: {
      estado: true,
    },
  });

  const hayCuotas = eventos.length > 0;
  const todasCerradas =
    hayCuotas &&
    eventos.every((evento) => {
      return (
        evento.estado === EstadoEventoFinanciero.PAGADO ||
        evento.estado === EstadoEventoFinanciero.CANCELADO_POR_ABONO
      );
    });

  await tx.credito.update({
    where: {
      id: creditoId,
    },
    data: {
      estado: todasCerradas ? EstadoCredito.CANCELADO : EstadoCredito.ACTIVO,
      fechaCancelacion: todasCerradas ? obtenerHoyColombia() : null,
      accionPor: "sistema",
    },
  });
}

/**
 * Marca una cuota programada como pagada.
 *
 * Regla heredada de Sheets:
 * - estado = PAGADO;
 * - fechaPago = hoy;
 * - montoPagado = valorProgramado;
 * - capitalPagado = capitalProgramado;
 * - interesPagado = interesProgramado.
 */
export async function registrarPagoCuota(formData: FormData): Promise<void> {
  const eventoId = leerCampoObligatorio(formData, "eventoId");
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const hoy = obtenerHoyColombia();

  await prisma.$transaction(async (tx) => {
    const evento = await tx.eventoFinanciero.findUnique({
      where: {
        id: eventoId,
      },
      select: {
        id: true,
        creditoId: true,
        tipo: true,
        estado: true,
        valorProgramado: true,
        capitalProgramado: true,
        interesProgramado: true,
      },
    });

    if (!evento || evento.creditoId !== creditoId) {
      throw new Error("La cuota no existe o no pertenece al crédito indicado.");
    }

    if (evento.tipo !== TipoEventoFinanciero.CUOTA_PROGRAMADA) {
      throw new Error("Solo se pueden pagar cuotas programadas desde esta acción.");
    }

    if (evento.estado === EstadoEventoFinanciero.PAGADO) {
      throw new Error("La cuota ya está marcada como pagada.");
    }

    if (evento.estado === EstadoEventoFinanciero.CANCELADO_POR_ABONO) {
      throw new Error("La cuota fue cancelada por abono a capital y no puede pagarse.");
    }

    await tx.eventoFinanciero.update({
      where: {
        id: evento.id,
      },
      data: {
        fechaPago: hoy,
        montoPagado: evento.valorProgramado,
        capitalPagado: evento.capitalProgramado,
        interesPagado: evento.interesProgramado,
        estado: EstadoEventoFinanciero.PAGADO,
        diasAtraso: 0,
        accionPor: "sistema",
      },
    });

    await sincronizarEstadoCredito(tx, creditoId);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}

/**
 * Reversa inicial de pago.
 *
 * Advertencia:
 * - Esta versión replica el comportamiento operativo de Sheets.
 * - En una fase posterior debe reemplazarse por reversa auditada con motivo,
 *   usuario y evento de reversa independiente.
 */
export async function reversarPagoCuota(formData: FormData): Promise<void> {
  const eventoId = leerCampoObligatorio(formData, "eventoId");
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const hoy = obtenerHoyColombia();

  await prisma.$transaction(async (tx) => {
    const evento = await tx.eventoFinanciero.findUnique({
      where: {
        id: eventoId,
      },
      select: {
        id: true,
        creditoId: true,
        tipo: true,
        estado: true,
        fechaProgramada: true,
      },
    });

    if (!evento || evento.creditoId !== creditoId) {
      throw new Error("La cuota no existe o no pertenece al crédito indicado.");
    }

    if (evento.tipo !== TipoEventoFinanciero.CUOTA_PROGRAMADA) {
      throw new Error("Solo se puede reversar el pago de cuotas programadas.");
    }

    if (evento.estado !== EstadoEventoFinanciero.PAGADO) {
      throw new Error("Solo se puede reversar una cuota pagada.");
    }

    const nuevoEstado = estadoPendientePorFecha(evento.fechaProgramada, hoy);

    await tx.eventoFinanciero.update({
      where: {
        id: evento.id,
      },
      data: {
        fechaPago: null,
        montoPagado: "0.00",
        capitalPagado: "0.00",
        interesPagado: "0.00",
        estado: nuevoEstado,
        diasAtraso:
          nuevoEstado === EstadoEventoFinanciero.ATRASADO
            ? calcularDiasAtraso(evento.fechaProgramada, hoy)
            : 0,
        accionPor: "sistema",
      },
    });

    await sincronizarEstadoCredito(tx, creditoId);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}

/**
 * Actualiza cuotas vencidas del crédito.
 *
 * Regla heredada de Sheets:
 * - PENDIENTE con fechaProgramada < hoy => ATRASADO.
 * - MORA queda reservada para una regla posterior explícita.
 */
export async function actualizarCuotasVencidasCredito(
  formData: FormData,
): Promise<void> {
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const hoy = obtenerHoyColombia();

  await prisma.$transaction(async (tx) => {
    const eventos = await tx.eventoFinanciero.findMany({
      where: {
        creditoId,
        tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
        estado: EstadoEventoFinanciero.PENDIENTE,
        fechaProgramada: {
          lt: hoy,
        },
      },
      select: {
        id: true,
        fechaProgramada: true,
      },
    });

    for (const evento of eventos) {
      await tx.eventoFinanciero.update({
        where: {
          id: evento.id,
        },
        data: {
          estado: EstadoEventoFinanciero.ATRASADO,
          diasAtraso: calcularDiasAtraso(evento.fechaProgramada, hoy),
          accionPor: "sistema",
        },
      });
    }

    await sincronizarEstadoCredito(tx, creditoId);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}
