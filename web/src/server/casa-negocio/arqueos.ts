/**
 * Arqueo: "Lopest dice" vs "contaste", per account. Capability: contar.
 *
 * The system balance is computed HERE, inside the transaction, from the live
 * rows; the browser only sends what was counted. A client-supplied "saldo del
 * sistema" could be stale (a cobro assigned a minute ago) or forged, and the
 * record must say what Lopest really believed at that moment. Written once,
 * never edited: a recount is a new arqueo.
 */
import { prisma } from "@/lib/prisma";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { parseInput } from "@/server/validation/input";
import { guardarArqueoSchema } from "@/features/casa-negocio/schemas";

import { requireCapacidad } from "./capacidades";
import { aCentavos, aDecimal, aPesos } from "./dinero";
import { CasaNegocioReglaError } from "./errors";
import { cargarAsientos, saldosActuales } from "./saldos";
import { ENTIDAD, accion, esViolacionUnica } from "./shared";

export interface ResultadoArqueo {
  arqueoId: string;
  repetido: boolean;
  detalles: { cuentaId: string; saldoSistema: number; contado: number; diferencia: number }[];
}

export async function guardarArqueo(raw: unknown): Promise<ResultadoArqueo> {
  const actor = await requireCapacidad("CONTAR");
  const { operationKey, nota, conteos } = parseInput(guardarArqueoSchema, raw);

  const leerExistente = async (): Promise<ResultadoArqueo | null> => {
    const existente = await prisma.cnArqueo.findUnique({
      where: { idempotencyKey: operationKey },
      include: { detalles: true },
    });
    if (!existente) return null;
    return {
      arqueoId: existente.id,
      repetido: true,
      detalles: existente.detalles.map((d) => ({
        cuentaId: d.cuentaId,
        saldoSistema: Number(d.saldoSistema),
        contado: Number(d.contado),
        diferencia: Number(d.diferencia),
      })),
    };
  };

  const previo = await leerExistente();
  if (previo) return previo;

  try {
    return await prisma.$transaction(async (tx) => {
      const ids = conteos.map((c) => c.cuentaId);
      const cuentas = await tx.cnCuenta.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true, archivada: true, saldoInicial: true, fechaSaldoInicial: true },
      });
      if (cuentas.length !== ids.length) throw new CasaNegocioReglaError("Una de las cuentas contadas no existe.");
      const archivada = cuentas.find((c) => c.archivada);
      if (archivada) throw new CasaNegocioReglaError(`La cuenta ${archivada.nombre} está archivada.`);

      const saldos = saldosActuales(cuentas, await cargarAsientos(tx, ids));
      const detalles = conteos.map((c) => {
        const saldoSistema = saldos.get(c.cuentaId) ?? 0;
        const diferencia = aPesos(aCentavos(c.contado) - aCentavos(saldoSistema));
        return { cuentaId: c.cuentaId, saldoSistema, contado: aPesos(aCentavos(c.contado)), diferencia };
      });

      const arqueo = await tx.cnArqueo.create({
        data: {
          idempotencyKey: operationKey,
          fecha: new Date(),
          nota,
          accionPor: actor.id,
          detalles: {
            create: detalles.map((d) => ({
              cuentaId: d.cuentaId,
              saldoSistema: aDecimal(d.saldoSistema),
              contado: aDecimal(d.contado),
              diferencia: aDecimal(d.diferencia),
            })),
          },
        },
      });
      await recordAuditLogTx(tx, {
        actorId: actor.id,
        action: accion("arqueo.guardar"),
        entityType: ENTIDAD.arqueo,
        entityId: arqueo.id,
        after: { fecha: arqueo.fecha.toISOString(), nota, detalles },
      });
      return { arqueoId: arqueo.id, repetido: false, detalles };
    });
  } catch (error) {
    if (esViolacionUnica(error)) {
      const twin = await leerExistente();
      if (twin) return twin;
    }
    throw error;
  }
}
