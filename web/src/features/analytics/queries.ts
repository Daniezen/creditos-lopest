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
  cuotasVencidas: number;
};

export type ResumenRiesgo = {
  totalCreditosEnMora: number;
  totalMoraDinero: number;
  mora1a30Count: number;
  mora1a30Monto: number;
  mora31a60Count: number;
  mora31a60Monto: number;
  mora61a90Count: number;
  mora61a90Monto: number;
  moraMas90Count: number;
  moraMas90Monto: number;
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

export async function getResumenRiesgo(user: CurrentUserScope): Promise<ResumenRiesgo> {
  const isAdmin = canSeeAllOwners(user);
  
  const filterClause = isAdmin
    ? Prisma.sql`1=1`
    : Prisma.sql`c."ownerUserId" = ${user.id}`;

  const rows = await prisma.$queryRaw<
    Array<{
      total_creditos_en_mora: bigint;
      total_mora_dinero: Prisma.Decimal;
      mora_1_30_count: bigint;
      mora_1_30_monto: Prisma.Decimal;
      mora_31_60_count: bigint;
      mora_31_60_monto: Prisma.Decimal;
      mora_61_90_count: bigint;
      mora_61_90_monto: Prisma.Decimal;
      mora_90_plus_count: bigint;
      mora_90_plus_monto: Prisma.Decimal;
    }>
  >`
    WITH mora_creditos AS (
      SELECT 
        c.id,
        MAX(GREATEST(e."diasAtraso", ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - e."fechaProgramada"::date))) as dias_atraso,
        SUM(e."capitalProgramado" - e."capitalPagado" + e."interesProgramado" - e."interesPagado") as monto_mora
      FROM "eventos_financieros" e
      JOIN "creditos" c ON e."creditoId" = c.id
      WHERE e."estado" IN ('ATRASADO', 'MORA')
        AND ${filterClause}
        AND c."eliminadoEn" IS NULL
      GROUP BY c.id
    )
    SELECT 
      COUNT(*) as total_creditos_en_mora,
      COALESCE(SUM(monto_mora), 0) as total_mora_dinero,
      COUNT(CASE WHEN dias_atraso <= 30 THEN 1 END) as mora_1_30_count,
      COALESCE(SUM(CASE WHEN dias_atraso <= 30 THEN monto_mora END), 0) as mora_1_30_monto,
      COUNT(CASE WHEN dias_atraso > 30 AND dias_atraso <= 60 THEN 1 END) as mora_31_60_count,
      COALESCE(SUM(CASE WHEN dias_atraso > 30 AND dias_atraso <= 60 THEN monto_mora END), 0) as mora_31_60_monto,
      COUNT(CASE WHEN dias_atraso > 60 AND dias_atraso <= 90 THEN 1 END) as mora_61_90_count,
      COALESCE(SUM(CASE WHEN dias_atraso > 60 AND dias_atraso <= 90 THEN monto_mora END), 0) as mora_61_90_monto,
      COUNT(CASE WHEN dias_atraso > 90 THEN 1 END) as mora_90_plus_count,
      COALESCE(SUM(CASE WHEN dias_atraso > 90 THEN monto_mora END), 0) as mora_90_plus_monto
    FROM mora_creditos;
  `;

  const r = rows[0];
  if (!r) {
    return {
      totalCreditosEnMora: 0,
      totalMoraDinero: 0,
      mora1a30Count: 0,
      mora1a30Monto: 0,
      mora31a60Count: 0,
      mora31a60Monto: 0,
      mora61a90Count: 0,
      mora61a90Monto: 0,
      moraMas90Count: 0,
      moraMas90Monto: 0,
    };
  }

  return {
    totalCreditosEnMora: Number(r.total_creditos_en_mora || 0),
    totalMoraDinero: Number(r.total_mora_dinero || 0),
    mora1a30Count: Number(r.mora_1_30_count || 0),
    mora1a30Monto: Number(r.mora_1_30_monto || 0),
    mora31a60Count: Number(r.mora_31_60_count || 0),
    mora31a60Monto: Number(r.mora_31_60_monto || 0),
    mora61a90Count: Number(r.mora_61_90_count || 0),
    mora61a90Monto: Number(r.mora_61_90_monto || 0),
    moraMas90Count: Number(r.mora_90_plus_count || 0),
    moraMas90Monto: Number(r.mora_90_plus_monto || 0),
  };
}

export async function getCreditosMayorMonto(user: CurrentUserScope, limit = 8): Promise<CreditoEnRiesgo[]> {
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
      cuotasVencidas: number;
    }>
  >`
    SELECT 
      c.id,
      c.codigo,
      cl.nombre as "clienteNombre",
      MAX(GREATEST(e."diasAtraso", ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - e."fechaProgramada"::date)))::int as "diasAtraso",
      SUM(e."capitalProgramado" - e."capitalPagado" + e."interesProgramado" - e."interesPagado") as "montoMora",
      COUNT(e.id)::int as "cuotasVencidas"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    JOIN "clientes" cl ON c."clienteId" = cl.id
    WHERE e."estado" IN ('ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY c.id, c.codigo, cl.nombre
    ORDER BY "montoMora" DESC, "diasAtraso" DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    clienteNombre: r.clienteNombre,
    diasAtraso: Number(r.diasAtraso),
    montoMora: Number(r.montoMora),
    cuotasVencidas: Number(r.cuotasVencidas),
  }));
}

export async function getCreditosMayorAtraso(user: CurrentUserScope, limit = 8): Promise<CreditoEnRiesgo[]> {
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
      cuotasVencidas: number;
    }>
  >`
    SELECT 
      c.id,
      c.codigo,
      cl.nombre as "clienteNombre",
      MAX(GREATEST(e."diasAtraso", ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date - e."fechaProgramada"::date)))::int as "diasAtraso",
      SUM(e."capitalProgramado" - e."capitalPagado" + e."interesProgramado" - e."interesPagado") as "montoMora",
      COUNT(e.id)::int as "cuotasVencidas"
    FROM "eventos_financieros" e
    JOIN "creditos" c ON e."creditoId" = c.id
    JOIN "clientes" cl ON c."clienteId" = cl.id
    WHERE e."estado" IN ('ATRASADO', 'MORA')
      AND ${filterClause}
      AND c."eliminadoEn" IS NULL
    GROUP BY c.id, c.codigo, cl.nombre
    ORDER BY "diasAtraso" DESC, "montoMora" DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    clienteNombre: r.clienteNombre,
    diasAtraso: Number(r.diasAtraso),
    montoMora: Number(r.montoMora),
    cuotasVencidas: Number(r.cuotasVencidas),
  }));
}
