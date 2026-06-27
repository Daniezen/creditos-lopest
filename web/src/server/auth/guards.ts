import { redirect } from "next/navigation";

import { getCurrentSession } from "./session";

export type AppRole = "ADMIN" | "OPERADOR" | "LECTURA";

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    nombre: session.user.nombre,
    roles: session.user.roles.map((item) => item.role.code as AppRole),
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(role: AppRole) {
  const user = await requireUser();

  if (!user.roles.includes(role)) {
    throw new Error("No tienes permisos para realizar esta acción.");
  }

  return user;
}

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
