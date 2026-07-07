import { prisma } from "@/lib/prisma";
import { hasRole, requireUser, type AppRole } from "@/server/auth/guards";

const TRANSFER_PAIR_EMAILS = ["lopestdcm@gmail.com", "marthadcg@gmail.com"] as const;

interface TransferUser {
  id: string;
  email: string;
  nombre: string;
  roles: AppRole[];
}

export interface TransferOwnerOption {
  id: string;
  email: string;
  nombre: string;
}

export interface TransferClienteOption {
  id: string;
  cedula: string;
  nombre: string;
  ownerUserId: string | null;
  ownerNombre: string | null;
  ownerEmail: string | null;
  creditosTotal: number;
}

export interface TransferCreditoOption {
  id: string;
  codigo: string;
  estado: string;
  monto: number;
  clienteId: string;
  clienteNombre: string;
  clienteCedula: string;
  ownerUserId: string | null;
  ownerNombre: string | null;
  ownerEmail: string | null;
}

export interface TransferenciasContext {
  user: TransferUser;
  isAdmin: boolean;
  owners: TransferOwnerOption[];
  clientes: TransferClienteOption[];
  creditos: TransferCreditoOption[];
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hasTransferPanelAccess(user: TransferUser): boolean {
  return hasRole(user, "ADMIN") || hasRole(user, "TRANSFERENCIAS_CARTERA");
}

function buildPairOwnerWhere() {
  return {
    email: {
      in: [...TRANSFER_PAIR_EMAILS],
      mode: "insensitive" as const,
    },
  };
}

/**
 * Exige acceso al panel de transferencias.
 *
 * Reglas:
 * - ADMIN: acceso total.
 * - TRANSFERENCIAS_CARTERA: acceso limitado al par padre <-> madre.
 * - OPERADOR normal / madre sin rol: sin acceso.
 */
export async function requireTransferenciasUser(): Promise<TransferUser> {
  const user = await requireUser();

  if (!hasTransferPanelAccess(user)) {
    throw new Error("No tienes permisos para acceder al panel de transferencias.");
  }

  return user;
}

export function canTransferAcrossAllOwners(user: TransferUser): boolean {
  return hasRole(user, "ADMIN");
}

/**
 * Valida si un usuario puede transferir entre los owners indicados.
 *
 * ADMIN puede transferir cualquier owner activo.
 * Padre con TRANSFERENCIAS_CARTERA queda restringido al par padre/madre.
 */
export function assertTransferPairAllowed(input: {
  user: TransferUser;
  sourceOwnerEmail: string | null | undefined;
  targetOwnerEmail: string;
}) {
  if (canTransferAcrossAllOwners(input.user)) {
    return;
  }

  const source = normalizeEmail(input.sourceOwnerEmail ?? "");
  const target = normalizeEmail(input.targetOwnerEmail);
  const allowed = TRANSFER_PAIR_EMAILS.map(normalizeEmail);

  if (!allowed.includes(source) || !allowed.includes(target)) {
    throw new Error("Solo puedes transferir cartera entre Germán y Martha.");
  }
}

export async function obtenerTransferenciasContext(): Promise<TransferenciasContext> {
  const user = await requireTransferenciasUser();
  const isAdmin = canTransferAcrossAllOwners(user);

  const ownerWhere = isAdmin
    ? {
        activo: true,
        roles: {
          some: {
            role: {
              code: "OPERADOR",
            },
          },
        },
      }
    : {
        activo: true,
        ...buildPairOwnerWhere(),
      };

  const owners = await prisma.user.findMany({
    where: ownerWhere,
    select: {
      id: true,
      email: true,
      nombre: true,
    },
    orderBy: [
      {
        nombre: "asc",
      },
      {
        email: "asc",
      },
    ],
  });

  const clienteWhere = isAdmin
    ? {}
    : {
        OR: [
          {
            ownerUser: buildPairOwnerWhere(),
          },
          {
            creditos: {
              some: {
                ownerUser: buildPairOwnerWhere(),
              },
            },
          },
        ],
      };

  const clientes = await prisma.cliente.findMany({
    where: clienteWhere,
    include: {
      ownerUser: {
        select: {
          id: true,
          email: true,
          nombre: true,
        },
      },
      _count: {
        select: {
          creditos: true,
        },
      },
    },
    orderBy: {
      nombre: "asc",
    },
    take: 500,
  });

  const creditoWhere = isAdmin
    ? {}
    : {
        ownerUser: buildPairOwnerWhere(),
      };

  const creditos = await prisma.credito.findMany({
    where: creditoWhere,
    include: {
      ownerUser: {
        select: {
          id: true,
          email: true,
          nombre: true,
        },
      },
      cliente: {
        select: {
          id: true,
          cedula: true,
          nombre: true,
        },
      },
    },
    orderBy: [
      {
        creadoEn: "desc",
      },
      {
        codigo: "asc",
      },
    ],
    take: 500,
  });

  return {
    user,
    isAdmin,
    owners,
    clientes: clientes.map((cliente) => ({
      id: cliente.id,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      ownerUserId: cliente.ownerUserId,
      ownerNombre: cliente.ownerUser?.nombre ?? null,
      ownerEmail: cliente.ownerUser?.email ?? null,
      creditosTotal: cliente._count.creditos,
    })),
    creditos: creditos.map((credito) => ({
      id: credito.id,
      codigo: credito.codigo,
      estado: credito.estado,
      monto: Number(credito.monto),
      clienteId: credito.cliente.id,
      clienteNombre: credito.cliente.nombre,
      clienteCedula: credito.cliente.cedula,
      ownerUserId: credito.ownerUserId,
      ownerNombre: credito.ownerUser?.nombre ?? null,
      ownerEmail: credito.ownerUser?.email ?? null,
    })),
  };
}
