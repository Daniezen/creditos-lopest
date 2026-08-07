import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "../..");
const creditId = "cr_49aabb1eb01a0793b8ad25be";

// The dry run queries PostgreSQL directly because this project uses Prisma 7
// with a runtime adapter configured by the application bootstrap. The script
// must remain independent from that bootstrap and must never write data.
const sql = String.raw`\pset tuples_only on
\pset format unaligned
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
WITH target AS (
  SELECT
    c.id,
    c.codigo,
    c."tipoAmortizacion",
    c."tasaMensual",
    c.frecuencia,
    a.id AS abono_id,
    a."creadoEn" AS abono_creado,
    a."capitalPagado" AS abono_capital,
    a."saldoCapitalPost" AS saldo_post
  FROM creditos c
  JOIN LATERAL (
    SELECT e.*
    FROM eventos_financieros e
    WHERE e."creditoId" = c.id
      AND e.tipo = 'ABONO_CAPITAL'
      AND e.estado = 'PAGADO'
    ORDER BY e."creadoEn" DESC
    LIMIT 1
  ) a ON true
  WHERE c.id = '${creditId}'
), metrics AS (
  SELECT
    t.*,
    COUNT(e.id) FILTER (WHERE e.tipo = 'CUOTA_PROGRAMADA')::int AS schedule_length,
    COUNT(e.id) FILTER (
      WHERE e.tipo = 'CUOTA_PROGRAMADA' AND e.estado = 'PAGADO'
    )::int AS paid_installments,
    COUNT(e.id) FILTER (
      WHERE e.tipo = 'ABONO_CAPITAL'
        AND e.estado = 'PAGADO'
        AND e.id <> t.abono_id
        AND e."creadoEn" > t.abono_creado
    )::int AS later_prepayments
  FROM target t
  LEFT JOIN eventos_financieros e ON e."creditoId" = t.id
  GROUP BY
    t.id, t.codigo, t."tipoAmortizacion", t."tasaMensual", t.frecuencia,
    t.abono_id, t.abono_creado, t.abono_capital, t.saldo_post
)
SELECT json_build_object(
  'mode', 'READ_ONLY_DRY_RUN',
  'credit', codigo,
  'scheduleLength', schedule_length,
  'paidInstallments', paid_installments,
  'laterPrepayments', later_prepayments,
  'currentBalance', saldo_post,
  'restoredBalance', saldo_post + abono_capital,
  'projectedInterestPerInstallment',
    (saldo_post + abono_capital) *
    CASE WHEN frecuencia = 'MENSUAL' THEN "tasaMensual" ELSE "tasaMensual" / 2 END,
  'projectedLastInstallment',
    (saldo_post + abono_capital) +
    (saldo_post + abono_capital) *
    CASE WHEN frecuencia = 'MENSUAL' THEN "tasaMensual" ELSE "tasaMensual" / 2 END,
  'reversible',
    "tipoAmortizacion" = 'SOLO_INTERES'
    AND paid_installments = 0
    AND later_prepayments = 0
)
FROM metrics;
ROLLBACK;
`;

const composeArgs = [
  "compose",
  "--env-file",
  ".env.prod",
  "-f",
  "docker-compose.prod.yml",
  "exec",
  "-T",
  "postgres",
  "sh",
  "-lc",
  'psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
];

const output = execFileSync("docker", composeArgs, {
  cwd: repositoryRoot,
  input: sql,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "inherit"],
});

const jsonLine = output
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line.startsWith("{"));

if (!jsonLine) {
  throw new Error("El dry run no devolvió el resultado JSON esperado.");
}

const result = JSON.parse(jsonLine);
console.log(JSON.stringify(result, null, 2));

if (
  result.credit !== "LP-26-0294" ||
  result.scheduleLength !== 7 ||
  result.paidInstallments !== 0 ||
  result.laterPrepayments !== 0 ||
  Number(result.currentBalance) !== 1_500_000 ||
  Number(result.restoredBalance) !== 2_000_000 ||
  Number(result.projectedInterestPerInstallment) !== 300_000 ||
  Number(result.projectedLastInstallment) !== 2_300_000 ||
  result.reversible !== true
) {
  process.exitCode = 2;
  throw new Error("El estado real de LP-26-0294 no coincide con las precondiciones aprobadas.");
}
