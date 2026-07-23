"use server";

import { revalidatePath } from "next/cache";
import { EstadoCredito, EstadoEventoFinanciero, TipoEventoFinanciero } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";
import { recordAuditLogTx } from "@/server/audit/audit-log";

import { isAbonoReversible } from "./reversibility";
import type { FinancialEventImage } from "./snapshot";

interface SnapshotCredit {
  estado: EstadoCredito;
  fechaCancelacion: string | null;
}

/** Restores only installments changed by the abono and preserves unrelated payments. */
export async function reversarAbonoCapital(formData: FormData): Promise<void> {
  const creditoId = required(formData, "creditoId");
  const abonoEventoId = required(formData, "abonoEventoId");
  const motivo = optional(formData, "motivo");
  if (motivo.length > 500) throw new Error("El motivo no puede superar 500 caracteres.");

  const { user } = await requireCreditoAccess(creditoId);
  assertCanMutate(user);

  await prisma.$transaction(async (tx) => {
    const abono = await tx.eventoFinanciero.findUnique({
      where: { id: abonoEventoId },
      include: { abonoSnapshot: true },
    });
    if (!abono || abono.creditoId !== creditoId || abono.tipo !== TipoEventoFinanciero.ABONO_CAPITAL) {
      throw new Error("El abono no existe o no pertenece al credito.");
    }
    if (!abono.abonoSnapshot) throw new Error("Este abono no tiene un snapshot seguro.");

    const eventosActuales = await tx.eventoFinanciero.findMany({
      where: { creditoId, tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA },
    });
    if (!isAbonoReversible({
      eventosDespues: abono.abonoSnapshot.eventosDespues,
      currentEvents: eventosActuales,
    })) {
      throw new Error("El abono ya no puede revertirse porque una cuota afectada cambio posteriormente.");
    }

    const eventosAntes = abono.abonoSnapshot.eventosAntes as unknown as FinancialEventImage[];
    const creditoAntes = abono.abonoSnapshot.creditoAntes as unknown as SnapshotCredit;

    for (const evento of eventosAntes) {
      await tx.eventoFinanciero.update({
        where: { id: evento.id },
        data: {
          fechaProgramada: new Date(evento.fechaProgramada),
          fechaPago: evento.fechaPago ? new Date(evento.fechaPago) : null,
          valorProgramado: evento.valorProgramado,
          capitalProgramado: evento.capitalProgramado,
          interesProgramado: evento.interesProgramado,
          montoPagado: evento.montoPagado,
          capitalPagado: evento.capitalPagado,
          interesPagado: evento.interesPagado,
          saldoCapitalPost: evento.saldoCapitalPost,
          estado: evento.estado as EstadoEventoFinanciero,
          diasAtraso: evento.diasAtraso,
          accionPor: user.id,
        },
      });
    }

    await tx.credito.update({
      where: { id: creditoId },
      data: {
        estado: creditoAntes.estado,
        fechaCancelacion: creditoAntes.fechaCancelacion
          ? new Date(creditoAntes.fechaCancelacion)
          : null,
        accionPor: user.id,
      },
    });

    await recordAuditLogTx(tx, {
      actorId: user.id,
      action: "ABONO_CAPITAL_REVERSE",
      entityType: "EventoFinanciero",
      entityId: abono.id,
      reason: motivo || null,
      before: {
        codigo: abono.codigo,
        monto: String(abono.capitalPagado),
        snapshotId: abono.abonoSnapshot.id,
      },
      after: { restoredEventIds: eventosAntes.map((evento) => evento.id) },
      metadata: {
        creditoId,
        versionAlgoritmo: abono.abonoSnapshot.versionAlgoritmo,
      },
    });

    await tx.eventoFinanciero.delete({ where: { id: abono.id } });
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}

function required(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta el campo obligatorio ${name}.`);
  }
  return value.trim();
}

function optional(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
