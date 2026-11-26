"use server";

import { revalidatePath } from "next/cache";

import { guardarArqueo, type ResultadoArqueo } from "@/server/casa-negocio/arqueos";
import { CasaNegocioPermisoError, CasaNegocioReglaError } from "@/server/casa-negocio/errors";
import { fallaDeAccion, type ResultadoAccion } from "@/server/casa-negocio/vista-arqueo";
import { InputValidationError } from "@/server/validation/input";

/** The whole module re-reads: balances and the month line change with this. */
const MODULO = "/casa-negocio";

const CONOCIDOS = [CasaNegocioPermisoError, CasaNegocioReglaError, InputValidationError];

/**
 * «Guardar arqueo»: only the accounts that were counted. The service demands
 * `contar`, recomputes «Lopest dice» inside its transaction and replays the
 * same arqueo for a repeated operation key (double click).
 */
export async function guardarArqueoAction(input: {
  operationKey: string;
  conteos: { cuentaId: string; contado: string }[];
}): Promise<ResultadoAccion<ResultadoArqueo>> {
  try {
    const datos = await guardarArqueo(input);
    revalidatePath(MODULO, "layout");
    const cuadran = datos.detalles.filter((d) => d.diferencia === 0).length;
    return {
      ok: true,
      mensaje: datos.repetido
        ? "Este arqueo ya estaba guardado."
        : `Arqueo guardado: ${cuadran} de ${datos.detalles.length} ${cuadran === 1 ? "cuadra" : "cuadran"}.`,
      datos,
    };
  } catch (error) {
    return fallaDeAccion(error, CONOCIDOS);
  }
}
