"use server";

import { revalidatePath } from "next/cache";
import { EstadoCredito, EstadoEventoFinanciero, TipoEventoFinanciero } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { formFields, parseInput } from "@/server/validation/input";

import { isAbonoReversible } from "./reversibility";
import { puedeRevertirAbonoRecalculando, recalcularSoloInteresTrasReversion } from "./recalculated-reversal-policy";
import type { FinancialEventImage } from "./snapshot";
import { REVERSAR_ABONO_FIELDS, reversarAbonoSchema } from "./schemas";

interface SnapshotCredit {
  estado: EstadoCredito;
  fechaCancelacion: string | null;
}

/** Restores only installments changed by the abono and preserves unrelated payments. */
export async function reversarAbonoCapital(formData: FormData): Promise<void> {
  const { creditoId, abonoEventoId, motivo } = parseInput(
    reversarAbonoSchema,
    formFields(formData, REVERSAR_ABONO_FIELDS),
  );

  const { user } = await requireCreditoAccess(creditoId);
  assertCanMutate(user);

  await prisma.$transaction(async (tx) => {
    const abono = await tx.eventoFinanciero.findUnique({
      where: { id: abonoEventoId },
      include: {
        abonoSnapshot: true,
        credito: { select: { tipoAmortizacion: true, frecuencia: true, tasaMensual: true } },
      },
    });
    if (!abono || abono.creditoId !== creditoId || abono.tipo !== TipoEventoFinanciero.ABONO_CAPITAL) {
      throw new Error("El abono no existe o no pertenece al credito.");
    }
    if (!abono.abonoSnapshot) throw new Error("Este abono no tiene un snapshot seguro.");

    const todosLosEventos = await tx.eventoFinanciero.findMany({ where: { creditoId } });
    const eventosActuales = todosLosEventos.filter((e) => e.tipo === TipoEventoFinanciero.CUOTA_PROGRAMADA);
    const reversionExacta = isAbonoReversible({ eventosDespues: abono.abonoSnapshot.eventosDespues, currentEvents: eventosActuales });
    const reversionRecalculada = !reversionExacta && puedeRevertirAbonoRecalculando({
      abonoId: abono.id,
      abonoCreadoEn: abono.creadoEn,
      tipoAmortizacion: abono.credito.tipoAmortizacion,
      eventos: todosLosEventos,
    });
    if (!reversionExacta && !reversionRecalculada) {
      throw new Error("El abono no puede revertirse porque existen cuotas pagadas, otro abono posterior o no admite recálculo seguro.");
    }

    const eventosAntes = abono.abonoSnapshot.eventosAntes as unknown as FinancialEventImage[];
    const creditoAntes = abono.abonoSnapshot.creditoAntes as unknown as SnapshotCredit;

    if (reversionExacta) {
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
    } else {
      const saldoRestaurado = Number(abono.saldoCapitalPost ?? 0) + Number(abono.capitalPagado);
      const recalculadas = recalcularSoloInteresTrasReversion({
        saldoRestaurado,
        tasaMensual: Number(abono.credito.tasaMensual),
        frecuencia: abono.credito.frecuencia,
        cuotas: eventosActuales,
      });
      for (const cuota of recalculadas) {
        await tx.eventoFinanciero.update({
          where: { id: cuota.id },
          data: {
            valorProgramado: cuota.valorProgramado.toFixed(2),
            capitalProgramado: cuota.capitalProgramado.toFixed(2),
            interesProgramado: cuota.interesProgramado.toFixed(2),
            saldoCapitalPost: cuota.saldoCapitalPost.toFixed(2),
            accionPor: user.id,
          },
        });
      }
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
      after: {
        restoredEventIds: reversionExacta
          ? eventosAntes.map((evento) => evento.id)
          : eventosActuales.map((evento) => evento.id),
        reversionMode: reversionExacta ? "EXACT_SNAPSHOT" : "RECALCULATED_CURRENT_SCHEDULE",
      },
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
