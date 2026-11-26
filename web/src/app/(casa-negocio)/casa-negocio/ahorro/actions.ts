"use server";

import { revalidatePath } from "next/cache";

import { CasaNegocioPermisoError, CasaNegocioReglaError } from "@/server/casa-negocio/errors";
import { pasarCierreAlAhorro, type ResultadoCierre } from "@/server/casa-negocio/vista-ahorro";
import { fallaDeAccion, type ResultadoAccion } from "@/server/casa-negocio/vista-arqueo";
import { ConcurrentModificationError } from "@/server/optimistic-lock";
import { InputValidationError } from "@/server/validation/input";

/** The whole module re-reads: balances and the month line change with this. */
const MODULO = "/casa-negocio";

const CONOCIDOS = [CasaNegocioPermisoError, CasaNegocioReglaError, InputValidationError, ConcurrentModificationError];

/**
 * «Pasar al ahorro» of the month's cierre. The service checks the capability
 * (`anotar`), validates, and refuses a second transfer for the same month;
 * a repeated click answers with the transfer already made.
 */
export async function pasarCierreAlAhorroAction(input: {
  mes: string;
  cuentaOrigenId: string;
  monto: string;
}): Promise<ResultadoAccion<ResultadoCierre>> {
  try {
    const datos = await pasarCierreAlAhorro(input);
    revalidatePath(MODULO, "layout");
    return {
      ok: true,
      mensaje: datos.repetido ? "Este cierre ya estaba en el ahorro." : "Listo, pasó al ahorro.",
      datos,
    };
  } catch (error) {
    return fallaDeAccion(error, CONOCIDOS);
  }
}
