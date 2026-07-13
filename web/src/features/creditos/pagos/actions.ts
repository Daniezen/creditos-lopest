"use server";

import { revalidatePath } from "next/cache";
import {
  EstadoCredito,
  EstadoEventoFinanciero,
  TipoEventoFinanciero,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";
import { recordAuditLogTx } from "@/server/audit/audit-log";

import type { UpdatePaymentDateState } from "./payment-date-state";

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
  accionPor: string,
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
      accionPor,
    },
  });
}

export async function registrarPagoCuota(formData: FormData): Promise<void> {
  const eventoId = leerCampoObligatorio(formData, "eventoId");
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const hoy = obtenerHoyColombia();

  const { user } = await requireCreditoAccess(creditoId);
  assertCanMutate(user);

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
        fechaProgramada: true,
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
        diasAtraso: calcularDiasAtraso(evento.fechaProgramada, hoy),
        accionPor: user.id,
      },
    });

    await sincronizarEstadoCredito(tx, creditoId, user.id);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}

export async function actualizarFechaPagoCuota(
  _previousState: UpdatePaymentDateState,
  formData: FormData,
): Promise<UpdatePaymentDateState> {
  try {
    const eventoId = leerCampoObligatorio(formData, "eventoId");
    const creditoId = leerCampoObligatorio(formData, "creditoId");
    const fechaPagoRaw = leerCampoObligatorio(formData, "fechaPago");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaPagoRaw);

    if (!match) throw new Error("La fecha real de pago no tiene un formato válido.");

    const fechaPago = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (fechaPago.getFullYear() !== Number(match[1]) || fechaPago.getMonth() !== Number(match[2]) - 1 || fechaPago.getDate() !== Number(match[3])) {
      throw new Error("La fecha real de pago no es válida.");
    }

    const hoy = obtenerHoyColombia();
    if (fechaPago.getTime() > hoy.getTime()) throw new Error("La fecha real de pago no puede estar en el futuro.");

    const { user } = await requireCreditoAccess(creditoId);
    assertCanMutate(user);

    await prisma.$transaction(async (tx) => {
      const evento = await tx.eventoFinanciero.findUnique({
        where: { id: eventoId },
        include: { credito: { select: { id: true, codigo: true, fechaPrestamo: true } } },
      });

      if (!evento || evento.creditoId !== creditoId) throw new Error("La cuota no existe o no pertenece al crédito indicado.");
      if (evento.tipo !== TipoEventoFinanciero.CUOTA_PROGRAMADA) throw new Error("Solo se puede editar la fecha real de una cuota programada.");
      if (evento.estado !== EstadoEventoFinanciero.PAGADO || !evento.fechaPago) throw new Error("Solo se puede editar la fecha real de una cuota pagada.");
      if (fechaPago.getTime() < normalizarFechaSinHora(evento.credito.fechaPrestamo).getTime()) throw new Error("La fecha real de pago no puede ser anterior a la fecha del préstamo.");

      const diasAtraso = calcularDiasAtraso(evento.fechaProgramada, fechaPago);

      await tx.eventoFinanciero.update({ where: { id: evento.id }, data: { fechaPago, diasAtraso, accionPor: user.id } });
      await recordAuditLogTx(tx, {
        actorId: user.id,
        action: "CUOTA_UPDATE_PAYMENT_DATE",
        entityType: "EventoFinanciero",
        entityId: evento.id,
        before: { fechaPago: evento.fechaPago.toISOString(), diasAtraso: evento.diasAtraso },
        after: { fechaPago: fechaPago.toISOString(), diasAtraso },
        metadata: { creditoId: evento.credito.id, creditoCodigo: evento.credito.codigo, eventoCodigo: evento.codigo, numeroCuota: evento.numeroCuota },
      });
    });

    revalidatePath("/creditos");
    revalidatePath(`/creditos/${creditoId}`);
    return { ok: true, message: "Fecha real de pago actualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar la fecha real de pago." };
  }
}

export async function reversarPagoCuota(formData: FormData): Promise<void> {
  const eventoId = leerCampoObligatorio(formData, "eventoId");
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const hoy = obtenerHoyColombia();

  const { user } = await requireCreditoAccess(creditoId);
  assertCanMutate(user);

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
        accionPor: user.id,
      },
    });

    await sincronizarEstadoCredito(tx, creditoId, user.id);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}

export async function actualizarCuotasVencidasCredito(
  formData: FormData,
): Promise<void> {
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const hoy = obtenerHoyColombia();

  const { user } = await requireCreditoAccess(creditoId);
  assertCanMutate(user);

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
          accionPor: user.id,
        },
      });
    }

    await sincronizarEstadoCredito(tx, creditoId, user.id);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}
