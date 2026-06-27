import type { Prisma } from "@prisma/client";

/**
 * Reserva un código humano de crédito dentro de una transacción Prisma.
 *
 * Regla:
 * - El consecutivo se reinicia por año.
 * - El formato visible es LP-YY-NNNN.
 *
 * No se calcula leyendo el último crédito creado porque eso es vulnerable
 * a condiciones de carrera. La tabla SecuenciaCredito es la fuente
 * transaccional del consecutivo.
 */
export async function reservarCodigoCredito(
  tx: Prisma.TransactionClient,
  fechaPrestamo: Date,
): Promise<string> {
  const anio = fechaPrestamo.getFullYear();

  const secuencia = await tx.secuenciaCredito.upsert({
    where: {
      anio,
    },
    create: {
      anio,
      ultimoNumero: 1,
    },
    update: {
      ultimoNumero: {
        increment: 1,
      },
    },
    select: {
      ultimoNumero: true,
    },
  });

  const anioCorto = String(anio % 100).padStart(2, "0");
  const consecutivo = String(secuencia.ultimoNumero).padStart(4, "0");

  return `LP-${anioCorto}-${consecutivo}`;
}
