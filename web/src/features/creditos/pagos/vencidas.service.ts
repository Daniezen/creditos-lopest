import {
  EstadoEventoFinanciero,
  TipoEventoFinanciero,
  type Prisma,
} from "@prisma/client";

import { obtenerCorteExclusivoCuotasVencidas } from "./overdue-policy";

/**
 * Fecha calendario actual en Colombia.
 *
 * La mora operativa se evalúa por día calendario local, no por timestamp UTC.
 */
export function obtenerHoyColombia(): Date {
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

  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Marca como ATRASADO todas las cuotas PENDIENTE vencidas.
 *
 * Regla operativa:
 * - La cuota conserva PENDIENTE durante el día programado y el día siguiente.
 * - Desde el segundo día posterior pasa a ATRASADO.
 * - MORA queda reservada hasta definir regla explícita de días/interés.
 */
export async function actualizarCuotasVencidas(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const hoy = obtenerHoyColombia();
  const corteExclusivo = obtenerCorteExclusivoCuotasVencidas(hoy);

  const eventos = await tx.eventoFinanciero.findMany({
    where: {
      tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA,
      estado: EstadoEventoFinanciero.PENDIENTE,
      fechaProgramada: {
        lt: corteExclusivo,
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
        accionPor: "cron",
      },
    });
  }

  return eventos.length;
}
