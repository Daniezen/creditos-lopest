"use server";

/**
 * Server Actions of the manual movements, used by the Casa and Negocio tabs:
 * register, edit and void. Each one delegates to the phase-1 service, which
 * checks `casa_negocio.anotar` on the server, parses with the zod schema and
 * applies the optimistic lock; these wrappers only revalidate the module and
 * return a `ResultadoAccion` the forms can render field by field.
 */
import { revalidatePath } from "next/cache";

import { anularMovimiento, editarMovimiento, registrarMovimiento, type ResultadoMovimiento } from "@/server/casa-negocio/movimientos";

import { ejecutar, type ResultadoAccion } from "./resultado-accion";

/** Every tab of the module reads the same month, so all of them are refreshed. */
function revalidarModulo() {
  revalidatePath("/casa-negocio", "layout");
}

export async function anotarMovimientoAction(input: unknown): Promise<ResultadoAccion<ResultadoMovimiento>> {
  return ejecutar(
    () => registrarMovimiento(input),
    (r) => (r.repetido ? "Ya estaba anotado." : "Anotado."),
    revalidarModulo,
  );
}

export async function editarMovimientoAction(input: unknown): Promise<ResultadoAccion<ResultadoMovimiento>> {
  return ejecutar(() => editarMovimiento(input), () => "Cambios guardados.", revalidarModulo);
}

export async function anularMovimientoAction(input: unknown): Promise<ResultadoAccion<{ movimientoId: string }>> {
  return ejecutar(() => anularMovimiento(input), () => "Movimiento anulado.", revalidarModulo);
}
