import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guards";

export interface UsuarioOperadorActivoItem {
  id: string;
  email: string;
  nombre: string;
}

/**
 * Lista usuarios activos con rol OPERADOR para transferencia de clientes.
 *
 * Seguridad:
 * - Solo ADMIN puede consultar candidatos de propietario.
 * - No expone hash de password, OAuth, logs ni datos innecesarios.
 */
export async function obtenerUsuariosOperadoresActivos(): Promise<
  UsuarioOperadorActivoItem[]
> {
  await requireRole("ADMIN");

  return prisma.user.findMany({
    where: {
      activo: true,
      roles: {
        some: {
          role: {
            code: "OPERADOR",
          },
        },
      },
    },
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
}
