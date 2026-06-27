import { prisma } from "@/lib/prisma";

export async function obtenerCreditoDetalle(id: string) {
  return prisma.credito.findUnique({
    where: {
      id,
    },
    include: {
      cliente: {
        select: {
          id: true,
          cedula: true,
          nombre: true,
          telefono: true,
        },
      },
      eventos: {
        orderBy: [
          {
            numeroCuota: "asc",
          },
          {
            creadoEn: "asc",
          },
        ],
      },
    },
  });
}
