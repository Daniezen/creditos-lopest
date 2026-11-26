"use server";

/**
 * «¿Dónde entró?» / «¿De dónde salió?»: stores the account of a cobro or a
 * disbursement through the phase-1 `asignarCuenta` service (capability,
 * zod, loan scope and optimistic lock are all checked there).
 */
import { revalidatePath } from "next/cache";

import { asignarCuenta } from "@/server/casa-negocio/asignaciones";

import { ejecutar, type ResultadoAccion } from "../casa/resultado-accion";

export async function asignarCuentaAction(input: unknown): Promise<ResultadoAccion<{ asignacionId: string }>> {
  return ejecutar(
    () => asignarCuenta(input),
    () => "Cuenta asignada.",
    () => revalidatePath("/casa-negocio", "layout"),
  );
}
