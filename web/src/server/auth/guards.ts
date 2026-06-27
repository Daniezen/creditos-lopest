import { redirect } from "next/navigation";

import { auth } from "@/auth";

export type AppRole = "ADMIN" | "OPERADOR" | "LECTURA";

/**
 * Obtiene el usuario autenticado desde NextAuth y normaliza el contrato interno.
 *
 * Esta función autentica identidad, pero no valida acceso a entidades
 * específicas. Para eso se necesitan guards de negocio por cliente/crédito.
 */
export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    nombre: session.user.name ?? "",
    roles: session.user.roles as AppRole[],
  };
}

/**
 * Exige usuario autenticado.
 */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Exige un rol específico.
 */
export async function requireRole(role: AppRole) {
  const user = await requireUser();

  if (!user.roles.includes(role)) {
    throw new Error("No tienes permisos para realizar esta acción.");
  }

  return user;
}

/**
 * Exige al menos uno de los roles indicados.
 */
export async function requireAnyRole(roles: AppRole[]) {
  const user = await requireUser();

  const allowed = roles.some((role) => user.roles.includes(role));

  if (!allowed) {
    throw new Error("No tienes permisos para realizar esta acción.");
  }

  return user;
}

export function hasRole(user: { roles: AppRole[] }, role: AppRole): boolean {
  return user.roles.includes(role);
}
