import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hasRole, requireUser, type AppRole } from "@/server/auth/guards";

export interface CurrentUserScope {
  id: string;
  roles: AppRole[];
}

export function canSeeAllOwners(user: CurrentUserScope): boolean {
  return hasRole(user, "ADMIN");
}

/**
 * Un cliente es visible para un operador si:
 * - es propietario principal/documental del cliente; o
 * - tiene al menos un credito propio dentro de ese cliente.
 */
export function buildClienteVisibilityWhere(
  user: CurrentUserScope,
): Prisma.ClienteWhereInput {
  if (canSeeAllOwners(user)) {
    return {};
  }

  return {
    OR: [
      {
        ownerUserId: user.id,
      },
      {
        creditos: {
          some: {
            ownerUserId: user.id,
          },
        },
      },
    ],
  };
}

/**
 * La cartera financiera se controla a nivel de credito.
 */
export function buildCreditoVisibilityWhere(
  user: CurrentUserScope,
): Prisma.CreditoWhereInput {
  if (canSeeAllOwners(user)) {
    return {};
  }

  return {
    ownerUserId: user.id,
  };
}

export function buildEventoFinancieroVisibilityWhere(
  user: CurrentUserScope,
): Prisma.EventoFinancieroWhereInput {
  if (canSeeAllOwners(user)) {
    return {};
  }

  return {
    credito: {
      ownerUserId: user.id,
    },
  };
}

export async function requireClienteAccess(clienteId: string) {
  const user = await requireUser();

  const cliente = await prisma.cliente.findFirst({
    where: {
      id: clienteId,
      ...buildClienteVisibilityWhere(user),
    },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  if (!cliente) {
    throw new Error("No tienes permisos para acceder a este cliente.");
  }

  return { user, cliente };
}

export async function requireCreditoAccess(creditoId: string) {
  const user = await requireUser();

  const credito = await prisma.credito.findFirst({
    where: {
      id: creditoId,
      ...buildCreditoVisibilityWhere(user),
    },
    select: {
      id: true,
      clienteId: true,
      ownerUserId: true,
    },
  });

  if (!credito) {
    throw new Error("No tienes permisos para acceder a este credito.");
  }

  return { user, credito };
}

export function assertCanMutate(user: CurrentUserScope): void {
  if (hasRole(user, "ADMIN") || hasRole(user, "OPERADOR")) {
    return;
  }

  throw new Error("No tienes permisos para modificar informacion.");
}

export async function requireMutationUser() {
  const user = await requireUser();
  assertCanMutate(user);

  return user;
}
