import { prisma } from "@/lib/prisma";
import type { CurrentUserScope } from "@/server/auth/scope";
import { Prisma } from "@prisma/client";
import { canSeeAllOwners } from "@/server/auth/scope";

export type RecaudacionMes = {
  mes: Date;
  capital: number;
  interes: number;
  total: number;
};

export type ProyeccionMes = {
  mes: Date;
  capital: number;
  interes: number;
  total: number;
};

/**
 * Obtiene el histórico de recaudación agrupado por mes.
 * Filtra de forma segura garantizando el aislamiento de inquilino.
 */
export async function getHistoricoRecaudacion(user: CurrentUserScope): Promise<RecaudacionMes[]> {
  const isAdmin = canSeeAllOwners(user);
  
  // Condición de seguridad por ownerUserId:
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const rows = await prisma.$queryRaw<
    Array<{
      mes: Date;
      capital: Prisma.Decimal;
      interes: Prisma.Decimal;
    }>
  >`
    SELECT 
      DATE_TRUNC('month', e."fechaPago") as "mes",
      COALESCE(SUM(e."capitalPagado"), 0) as "capital",
      COALESCE(SUM(e."interesPagado"), 0) as "interes"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('PAGADO', 'CANCELADO_POR_ABONO')
      AND e."fechaPago" IS NOT NULL
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY DATE_TRUNC('month', e."fechaPago")
    ORDER BY "mes" ASC
  `;

  return rows.map((r) => {
    const capital = Number(r.capital);
    const interes = Number(r.interes);
    return {
      mes: r.mes,
      capital,
      interes,
      total: capital + interes,
    };
  });
}

/**
 * Obtiene la proyección futura agrupada por mes.
 * Filtra de forma segura garantizando el aislamiento de inquilino.
 */
export async function getProyeccionCartera(user: CurrentUserScope): Promise<ProyeccionMes[]> {
  const isAdmin = canSeeAllOwners(user);
  
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const rows = await prisma.$queryRaw<
    Array<{
      mes: Date;
      capital: Prisma.Decimal;
      interes: Prisma.Decimal;
    }>
  >`
    SELECT 
      DATE_TRUNC('month', e."fechaProgramada") as "mes",
      COALESCE(SUM(e."capitalProgramado" - e."capitalPagado"), 0) as "capital",
      COALESCE(SUM(e."interesProgramado" - e."interesPagado"), 0) as "interes"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('PENDIENTE', 'ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY DATE_TRUNC('month', e."fechaProgramada")
    ORDER BY "mes" ASC
  `;

  return rows.map((r) => {
    const capital = Number(r.capital);
    const interes = Number(r.interes);
    return {
      mes: r.mes,
      capital,
      interes,
      total: capital + interes,
    };
  });
}
