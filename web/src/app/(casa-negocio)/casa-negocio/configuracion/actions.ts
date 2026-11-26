"use server";

/**
 * Server Actions of the Configuración tab. Each one is a thin adapter: the
 * service in `@/server/casa-negocio/configuracion` checks CONFIGURAR, parses
 * with zod, claims the row version (optimistic lock) and writes the audit row
 * inside its transaction. Here we only map failures to an inline result and
 * revalidate the module, because accounts, expenses, goals and alert rules
 * feed every tab (Tablero, Casa, Arqueo...), not just this one.
 *
 * Inputs are plain objects of strings, the same shape the zod schemas of
 * `@/features/casa-negocio/schemas` expect from a form.
 */
import { revalidatePath } from "next/cache";

import {
  archivarCuenta,
  crearCategoria,
  crearCuenta,
  definirCapacidades,
  editarCategoria,
  editarConfiguracion,
  editarCuenta,
  editarReglaAviso,
  eliminarCuenta,
} from "@/server/casa-negocio/configuracion";
import { ejecutarAccion, type ResultadoAccion } from "@/server/casa-negocio/vista-configuracion";

const MODULO = "/casa-negocio";

async function correr(nombre: string, servicio: () => Promise<unknown>): Promise<ResultadoAccion> {
  const resultado = await ejecutarAccion(nombre, servicio);
  if (resultado.ok) revalidatePath(MODULO, "layout");
  return resultado;
}

export async function crearCuentaAction(input: unknown): Promise<ResultadoAccion> {
  return correr("cuenta.crear", () => crearCuenta(input));
}

export async function editarCuentaAction(input: unknown): Promise<ResultadoAccion> {
  return correr("cuenta.editar", () => editarCuenta(input));
}

export async function archivarCuentaAction(input: unknown): Promise<ResultadoAccion> {
  return correr("cuenta.archivar", () => archivarCuenta(input));
}

export async function eliminarCuentaAction(input: unknown): Promise<ResultadoAccion> {
  return correr("cuenta.eliminar", () => eliminarCuenta(input));
}

export async function crearGastoAction(input: unknown): Promise<ResultadoAccion> {
  return correr("categoria.crear", () => crearCategoria(input));
}

export async function editarGastoAction(input: unknown): Promise<ResultadoAccion> {
  return correr("categoria.editar", () => editarCategoria(input));
}

/** Monthly goal for the house and the savings account choice (one settings row). */
export async function editarConfiguracionAction(input: unknown): Promise<ResultadoAccion> {
  return correr("configuracion.editar", () => editarConfiguracion(input));
}

export async function editarAvisoAction(input: unknown): Promise<ResultadoAccion> {
  return correr("aviso.editar", () => editarReglaAviso(input));
}

export async function definirPermisosAction(input: unknown): Promise<ResultadoAccion> {
  return correr("permisos.definir", () => definirCapacidades(input));
}
