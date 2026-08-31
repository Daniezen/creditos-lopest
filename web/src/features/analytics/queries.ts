import { prisma } from "@/lib/prisma";
import type { CurrentUserScope } from "@/server/auth/scope";
import { Prisma } from "@prisma/client";
import { canSeeAllOwners } from "@/server/auth/scope";
import { addMonths, format, parse, isValid } from "date-fns";

export type RecaudacionMes = {
  mesStr: string; // YYYY-MM
  capital: number;
  interes: number;
  total: number;
};

export type ProyeccionMes = {
  mesStr: string; // YYYY-MM
  capital: number;
  interes: number;
  total: number;
};

export type ResumenCartera = {
  capitalActivo: number;
  interesProyectado: number;
  recaudadoEsteMes: number;
  capitalEnMora: number;
};

export type CreditoEnRiesgo = {
  id: string;
  codigo: string;
  clienteNombre: string;
  diasAtraso: number;
  montoMora: number;
};

function fillMissingMonths<T extends { mesStr: string; capital: number; interes: number; total: number }>(
  data: T[],
  createEmpty: (mesStr: string) => T
): T[] {
  if (data.length === 0) return [];
  
  const result: T[] = [];
  const minDate = parse(data[0].mesStr, 'yyyy-MM', new Date());
  const maxDate = parse(data[data.length - 1].mesStr, 'yyyy-MM', new Date());
  
  if (!isValid(minDate) || !isValid(maxDate)) return data;

  const dataMap = new Map(data.map(d => [d.mesStr, d]));
  
  let current = minDate;
  while (current <= maxDate) {
    const mesStr = format(current, 'yyyy-MM');
    if (dataMap.has(mesStr)) {
      result.push(dataMap.get(mesStr)!);
    } else {
      result.push(createEmpty(mesStr));
    }
    current = addMonths(current, 1);
  }
  
  return result;
}

export async function getHistoricoRecaudacion(user: CurrentUserScope): Promise<RecaudacionMes[]> {
  const isAdmin = canSeeAllOwners(user);
  
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const rows = await prisma.$queryRaw<
    Array<{
      mes: string;
      capital: Prisma.Decimal;
      interes: Prisma.Decimal;
    }>
  >`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', e."fechaPago"), 'YYYY-MM') as "mes",
      COALESCE(SUM(
        CASE 
          WHEN e."capitalPagado" > 0 OR e."interesPagado" > 0 THEN e."capitalPagado"
          WHEN e."tipo" = 'ABONO_CAPITAL' THEN e."montoPagado"
          ELSE e."capitalProgramado"
        END
      ), 0) as "capital",
      COALESCE(SUM(
        CASE 
          WHEN e."capitalPagado" > 0 OR e."interesPagado" > 0 THEN e."interesPagado"
          WHEN e."tipo" = 'ABONO_CAPITAL' THEN 0
          ELSE e."interesProgramado"
        END
      ), 0) as "interes"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('PAGADO', 'CANCELADO_POR_ABONO')
      AND e."fechaPago" IS NOT NULL
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const mapped = rows.map((r) => {
    const capital = Number(r.capital);
    const interes = Number(r.interes);
    return {
      mesStr: r.mes,
      capital,
      interes,
      total: capital + interes,
    };
  });

  return fillMissingMonths(mapped, (mesStr) => ({ mesStr, capital: 0, interes: 0, total: 0 }));
}

export async function getProyeccionCartera(user: CurrentUserScope): Promise<ProyeccionMes[]> {
  const isAdmin = canSeeAllOwners(user);
  
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const rows = await prisma.$queryRaw<
    Array<{
      mes: string;
      capital: Prisma.Decimal;
      interes: Prisma.Decimal;
    }>
  >`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', e."fechaProgramada"), 'YYYY-MM') as "mes",
      COALESCE(SUM(e."capitalProgramado" - e."capitalPagado"), 0) as "capital",
      COALESCE(SUM(e."interesProgramado" - e."interesPagado"), 0) as "interes"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('PENDIENTE', 'ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const mapped = rows.map((r) => {
    const capital = Number(r.capital);
    const interes = Number(r.interes);
    return {
      mesStr: r.mes,
      capital,
      interes,
      total: capital + interes,
    };
  });

  return fillMissingMonths(mapped, (mesStr) => ({ mesStr, capital: 0, interes: 0, total: 0 }));
}

export async function getResumenCartera(user: CurrentUserScope): Promise<ResumenCartera> {
  const isAdmin = canSeeAllOwners(user);
  
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const thisMonth = format(new Date(), 'yyyy-MM');

  // 1. Capital activo e Interes proyectado de los eventos pendientes/mora
  const pendientes = await prisma.$queryRaw<Array<{ capital: Prisma.Decimal; interes: Prisma.Decimal }>>`
    SELECT 
      COALESCE(SUM(e."capitalProgramado" - e."capitalPagado"), 0) as "capital",
      COALESCE(SUM(e."interesProgramado" - e."interesPagado"), 0) as "interes"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('PENDIENTE', 'ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
  `;

  // 2. Recaudado este mes
  const recaudado = await prisma.$queryRaw<Array<{ total: Prisma.Decimal }>>`
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN e."capitalPagado" > 0 OR e."interesPagado" > 0 THEN (e."capitalPagado" + e."interesPagado")
          ELSE e."montoPagado"
        END
      ), 0) as "total"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('PAGADO', 'CANCELADO_POR_ABONO')
      AND e."fechaPago" IS NOT NULL
      AND TO_CHAR(DATE_TRUNC('month', e."fechaPago"), 'YYYY-MM') = ${thisMonth}
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
  `;

  // 3. Capital en Mora / Atraso
  const mora = await prisma.$queryRaw<Array<{ capital: Prisma.Decimal }>>`
    SELECT 
      COALESCE(SUM(e."capitalProgramado" - e."capitalPagado"), 0) as "capital"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    WHERE e."estado" IN ('ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
  `;

  return {
    capitalActivo: Number(pendientes[0]?.capital || 0),
    interesProyectado: Number(pendientes[0]?.interes || 0),
    recaudadoEsteMes: Number(recaudado[0]?.total || 0),
    capitalEnMora: Number(mora[0]?.capital || 0),
  };
}

export async function getCreditosEnRiesgo(user: CurrentUserScope): Promise<CreditoEnRiesgo[]> {
  const isAdmin = canSeeAllOwners(user);
  
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      codigo: string;
      clienteNombre: string;
      diasAtraso: number;
      montoMora: Prisma.Decimal;
    }>
  >`
    SELECT 
      c.id,
      c.codigo,
      cl.nombre as "clienteNombre",
      MAX(e."diasAtraso") as "diasAtraso",
      SUM(e."capitalProgramado" - e."capitalPagado" + e."interesProgramado" - e."interesPagado") as "montoMora"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    JOIN "clientes" cl ON c."clienteId" = cl.id
    WHERE e."estado" IN ('ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY c.id, c.codigo, cl.nombre
    ORDER BY "montoMora" DESC, "diasAtraso" DESC
    LIMIT 10
  `;

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    clienteNombre: r.clienteNombre,
    diasAtraso: Number(r.diasAtraso),
    montoMora: Number(r.montoMora),
  }));
}
