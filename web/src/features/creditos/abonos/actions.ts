"use server";

import { revalidatePath } from "next/cache";
import {
  EstadoCredito,
  EstadoEventoFinanciero,
  FrecuenciaPago,
  TipoAmortizacion,
  TipoEventoFinanciero,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Formato decimal seguro para dinero en Prisma/PostgreSQL.
 */
function toMoneyDecimalString(value: number): string {
  return value.toFixed(2);
}

/**
 * Fecha calendario de Colombia.
 *
 * Los abonos, pagos y vencimientos se operan por día calendario local,
 * no por instante UTC.
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

function leerCampoObligatorio(formData: FormData, name: string): string {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta el campo obligatorio ${name}.`);
  }

  return value.trim();
}

/**
 * Acepta formato colombiano:
 * - "100000"
 * - "100.000"
 * - "$100.000"
 * - "100000,50"
 */
function parseMontoInput(value: string): number {
  const cleaned = value
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function esEstadoPendienteOperativo(estado: EstadoEventoFinanciero): boolean {
  return (
    estado === EstadoEventoFinanciero.PENDIENTE ||
    estado === EstadoEventoFinanciero.ATRASADO ||
    estado === EstadoEventoFinanciero.MORA
  );
}

/**
 * Sincroniza estado global del crédito después de pagos/abonos.
 *
 * Regla:
 * - si todas las cuotas programadas están PAGADO o CANCELADO_POR_ABONO,
 *   el crédito queda CANCELADO;
 * - en caso contrario queda ACTIVO.
 */
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
 * Recalcula saldos capital post después de mutar cuotas futuras.
 *
 * No guarda resúmenes como fuente de verdad; solo actualiza el saldo proyectado
 * por evento/cuota para mantener la vista coherente.
 */
async function recalcularSaldosCapitalPost(
  tx: Prisma.TransactionClient,
  creditoId: string,
): Promise<void> {
  const credito = await tx.credito.findUnique({
    where: {
      id: creditoId,
    },
    include: {
      eventos: {
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
    throw new Error("El crédito no existe para recalcular saldos.");
  }

  const capitalInicial = Number(credito.monto);

  const capitalPagadoHistorico = credito.eventos.reduce((total, evento) => {
    if (evento.estado !== EstadoEventoFinanciero.PAGADO) {
      return total;
    }

    return total + Number(evento.capitalPagado || 0);
  }, 0);

  let capitalProyectado = Math.max(0, capitalInicial - capitalPagadoHistorico);

  const cuotasFuturas = credito.eventos
    .filter((evento) => evento.tipo === TipoEventoFinanciero.CUOTA_PROGRAMADA)
    .filter((evento) => evento.estado !== EstadoEventoFinanciero.PAGADO)
    .sort((a, b) => Number(a.numeroCuota ?? 0) - Number(b.numeroCuota ?? 0));

  for (const cuota of cuotasFuturas) {
    const capitalProgramado = Number(cuota.capitalProgramado || 0);
    const saldoPost = Math.max(0, capitalProyectado - capitalProgramado);

    await tx.eventoFinanciero.update({
      where: {
        id: cuota.id,
      },
      data: {
        saldoCapitalPost: toMoneyDecimalString(saldoPost),
      },
    });

    capitalProyectado = saldoPost;
  }
}

/**
 * Registra un abono extraordinario a capital.
 *
 * Regla heredada de Sheets:
 * - Crea evento ABONO_CAPITAL pagado.
 * - AMORTIZACION_FIJA: reduce plazo atacando cuotas futuras desde la cola.
 * - SOLO_INTERES: reduce base de capital y recalcula intereses futuros.
 */
export async function registrarAbonoCapital(formData: FormData): Promise<void> {
  const creditoId = leerCampoObligatorio(formData, "creditoId");
  const montoRaw = leerCampoObligatorio(formData, "montoAbono");
  const montoAbono = parseMontoInput(montoRaw);
  const hoy = obtenerHoyColombia();

  if (!Number.isFinite(montoAbono) || montoAbono <= 0) {
    throw new Error("Ingresa un monto de abono válido mayor a cero.");
  }

  await prisma.$transaction(async (tx) => {
    const credito = await tx.credito.findUnique({
      where: {
        id: creditoId,
      },
      include: {
        eventos: {
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
      throw new Error("No se puede abonar a un crédito cancelado.");
    }

    const cuotasOperativas = credito.eventos.filter((evento) => {
      return (
        evento.tipo === TipoEventoFinanciero.CUOTA_PROGRAMADA &&
        esEstadoPendienteOperativo(evento.estado)
      );
    });

    const saldoCapitalOperativo = cuotasOperativas.reduce((total, evento) => {
      return total + Number(evento.capitalProgramado || 0);
    }, 0);

    if (saldoCapitalOperativo <= 0) {
      throw new Error("El crédito no tiene saldo de capital pendiente para abonar.");
    }

    if (montoAbono > saldoCapitalOperativo) {
      throw new Error(
        `El abono ${toMoneyDecimalString(montoAbono)} supera el saldo de capital pendiente ${toMoneyDecimalString(saldoCapitalOperativo)}.`,
      );
    }

    const saldoPosteriorAbono = Math.max(0, saldoCapitalOperativo - montoAbono);

    await tx.eventoFinanciero.create({
      data: {
        codigo: `${credito.codigo}-ABX-${Date.now()}`,
        creditoId: credito.id,
        numeroCuota: null,
        tipo: TipoEventoFinanciero.ABONO_CAPITAL,
        fechaProgramada: hoy,
        fechaPago: hoy,
        valorProgramado: toMoneyDecimalString(montoAbono),
        capitalProgramado: toMoneyDecimalString(montoAbono),
        interesProgramado: "0.00",
        montoPagado: toMoneyDecimalString(montoAbono),
        capitalPagado: toMoneyDecimalString(montoAbono),
        interesPagado: "0.00",
        saldoCapitalPost: toMoneyDecimalString(saldoPosteriorAbono),
        estado: EstadoEventoFinanciero.PAGADO,
        diasAtraso: 0,
        accionPor: "sistema",
      },
    });

    if (credito.tipoAmortizacion === TipoAmortizacion.SOLO_INTERES) {
      await aplicarAbonoSoloInteres({
        tx,
        frecuencia: credito.frecuencia,
        tasaMensual: Number(credito.tasaMensual),
        cuotasOperativas,
        nuevoSaldoCapital: saldoPosteriorAbono,
      });
    } else {
      await aplicarAbonoAmortizacionFija({
        tx,
        cuotasOperativas,
        montoAbono,
      });
    }

    await recalcularSaldosCapitalPost(tx, credito.id);
    await sincronizarEstadoCredito(tx, credito.id);
  });

  revalidatePath("/creditos");
  revalidatePath(`/creditos/${creditoId}`);
}

/**
 * Amortización fija:
 * El abono reduce plazo atacando cuotas futuras desde la última hacia atrás.
 */
async function aplicarAbonoAmortizacionFija(input: {
  tx: Prisma.TransactionClient;
  cuotasOperativas: Array<{
    id: string;
    numeroCuota: number | null;
    capitalProgramado: unknown;
    interesProgramado: unknown;
  }>;
  montoAbono: number;
}): Promise<void> {
  let restante = input.montoAbono;

  const cuotasDesdeCola = [...input.cuotasOperativas].sort(
    (a, b) => Number(b.numeroCuota ?? 0) - Number(a.numeroCuota ?? 0),
  );

  for (const cuota of cuotasDesdeCola) {
    if (restante <= 0) {
      break;
    }

    const capitalProgramado = Number(cuota.capitalProgramado || 0);
    const interesProgramado = Number(cuota.interesProgramado || 0);

    if (restante >= capitalProgramado) {
      restante -= capitalProgramado;

      await input.tx.eventoFinanciero.update({
        where: {
          id: cuota.id,
        },
        data: {
          capitalProgramado: "0.00",
          interesProgramado: "0.00",
          valorProgramado: "0.00",
          estado: EstadoEventoFinanciero.CANCELADO_POR_ABONO,
          diasAtraso: 0,
          accionPor: "sistema",
        },
      });
    } else {
      const nuevoCapital = capitalProgramado - restante;
      const nuevoValor = nuevoCapital + interesProgramado;

      await input.tx.eventoFinanciero.update({
        where: {
          id: cuota.id,
        },
        data: {
          capitalProgramado: toMoneyDecimalString(nuevoCapital),
          valorProgramado: toMoneyDecimalString(nuevoValor),
          accionPor: "sistema",
        },
      });

      restante = 0;
    }
  }
}

/**
 * Solo interés:
 * El abono reduce la base de capital y recalcula el interés futuro.
 */
async function aplicarAbonoSoloInteres(input: {
  tx: Prisma.TransactionClient;
  frecuencia: FrecuenciaPago;
  tasaMensual: number;
  cuotasOperativas: Array<{
    id: string;
    numeroCuota: number | null;
  }>;
  nuevoSaldoCapital: number;
}): Promise<void> {
  const cuotasOrdenadas = [...input.cuotasOperativas].sort(
    (a, b) => Number(a.numeroCuota ?? 0) - Number(b.numeroCuota ?? 0),
  );

  if (cuotasOrdenadas.length === 0) {
    return;
  }

  if (input.nuevoSaldoCapital === 0) {
    await input.tx.eventoFinanciero.updateMany({
      where: {
        id: {
          in: cuotasOrdenadas.map((cuota) => cuota.id),
        },
      },
      data: {
        capitalProgramado: "0.00",
        interesProgramado: "0.00",
        valorProgramado: "0.00",
        estado: EstadoEventoFinanciero.CANCELADO_POR_ABONO,
        diasAtraso: 0,
        accionPor: "sistema",
      },
    });

    return;
  }

  const tasaPeriodo =
    input.frecuencia === FrecuenciaPago.MENSUAL
      ? input.tasaMensual
      : input.tasaMensual / 2;

  const nuevoInteresPeriodo = input.nuevoSaldoCapital * tasaPeriodo;
  const ultimaCuotaId = cuotasOrdenadas[cuotasOrdenadas.length - 1]?.id;

  for (const cuota of cuotasOrdenadas) {
    const esUltima = cuota.id === ultimaCuotaId;
    const capitalProgramado = esUltima ? input.nuevoSaldoCapital : 0;
    const valorProgramado = nuevoInteresPeriodo + capitalProgramado;

    await input.tx.eventoFinanciero.update({
      where: {
        id: cuota.id,
      },
      data: {
        interesProgramado: toMoneyDecimalString(nuevoInteresPeriodo),
        capitalProgramado: toMoneyDecimalString(capitalProgramado),
        valorProgramado: toMoneyDecimalString(valorProgramado),
        accionPor: "sistema",
      },
    });
  }
}
