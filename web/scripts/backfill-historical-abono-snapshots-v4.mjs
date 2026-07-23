import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const APPROVED_SOURCE_SHA256 = "649fe0d68d0f6e5de1893477c1e5154eac078f85e00e437380bd95e8b82a3c15";
const VALID_CLASSIFICATIONS = new Set([
  "RECONSTRUIBLE",
  "BLOQUEADO_POR_CAMBIO_POSTERIOR",
]);
const MONEY_TOLERANCE = 0.011;
const LEGACY_SUBPESO_TOLERANCE = 0.15;
const CREATED_BY = "historical-abono-backfill-v4";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if (args.has("--dry-run") && apply) throw new Error("Use solo --dry-run o --apply, no ambos.");
if (!args.has("--dry-run") && !apply) {
  throw new Error("Modo obligatorio: --dry-run o --apply.");
}

const executionDirectory = process.cwd();
const projectRoot = basename(executionDirectory) === "web"
  ? resolve(executionDirectory, "..")
  : executionDirectory;
const webRoot = join(projectRoot, "web");
const sourcePath = join(webRoot, "scripts/salidas/historical-abonos-backfill-dry-run-v4.json");
const reportPath = join(
  webRoot,
  `scripts/salidas/historical-abono-snapshots-backfill-v4-${apply ? "apply" : "dry-run"}.json`,
);

const sourceBytes = readFileSync(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceSha256 !== APPROVED_SOURCE_SHA256) {
  throw new Error(`SOURCE_HASH_MISMATCH:${sourceSha256}`);
}
const source = JSON.parse(sourceBytes.toString("utf8"));
validateSourceContract(source);
const candidates = flattenCandidates(source);
validateCandidateChains(candidates);

const databaseUrl = process.env.DATABASE_URL?.trim() || loadEnv(join(projectRoot, ".env.prod")).DATABASE_URL;
if (!databaseUrl) throw new Error("Falta DATABASE_URL en el entorno o en .env.prod.");

const report = {
  generatedAtUtc: new Date().toISOString(),
  mode: apply ? "APPLY" : "DRY_RUN_ROLLBACK",
  source: {
    path: "scripts/salidas/historical-abonos-backfill-dry-run-v4.json",
    sha256: sourceSha256,
    algorithmVersion: source.algorithmVersion,
  },
  summary: {
    sourceHistoricalAbonos: source.summary.historicalAbonos,
    validCandidates: candidates.length,
    excludedNonReconstructible: source.summary.nonReconstructible,
    plannedInsertions: 0,
    existingSnapshots: 0,
    insertedSnapshots: 0,
    discrepancies: 0,
    transactionCommitted: false,
  },
  results: [],
};

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

  for (const candidate of candidates) {
    const result = await validateAndPlanCandidate(client, candidate, candidates);
    report.results.push(result);
    if (result.status === "EXISTING") report.summary.existingSnapshots += 1;
    else if (result.status === "PLANNED") report.summary.plannedInsertions += 1;
    else report.summary.discrepancies += 1;
  }

  if (report.summary.discrepancies > 0) {
    throw new Error(`BACKFILL_VALIDATION_FAILED:${report.summary.discrepancies}`);
  }

  if (apply) {
    for (const result of report.results.filter((item) => item.status === "PLANNED")) {
      await insertSnapshot(client, result);
      result.status = "INSERTED";
      report.summary.insertedSnapshots += 1;
    }
    await client.query("COMMIT");
    report.summary.transactionCommitted = true;
  } else {
    await client.query("ROLLBACK");
  }
} catch (error) {
  try { await client.query("ROLLBACK"); } catch {}
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await client.end();
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, serialized, "utf8");
console.log(`Ruta: ${reportPath.replace(`${webRoot}/`, "")}`);
console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
console.log(JSON.stringify(report.summary, null, 2));
if (report.error) throw new Error(report.error);
console.log(apply ? "[OK] Backfill confirmado." : "[OK] Dry-run completado con ROLLBACK.");

function validateSourceContract(document) {
  if (document.mode !== "DRY_RUN_READ_ONLY") throw new Error(`INVALID_SOURCE_MODE:${document.mode}`);
  if (document.algorithmVersion !== 4) throw new Error(`INVALID_ALGORITHM_VERSION:${document.algorithmVersion}`);
  if (document.summary?.historicalAbonos !== 47) throw new Error("UNEXPECTED_HISTORICAL_ABONO_COUNT");
  const classified = document.summary.reconstructible +
    document.summary.blockedByAffectedPayment +
    document.summary.nonReconstructible;
  if (classified !== document.summary.historicalAbonos) throw new Error("SOURCE_SUMMARY_DOES_NOT_BALANCE");
}

function flattenCandidates(document) {
  return document.results.flatMap((credit) => credit.abonos
    .filter((abono) => VALID_CLASSIFICATIONS.has(abono.classification))
    .map((abono) => ({
      creditoId: credit.creditoId,
      creditoCodigo: credit.creditoCodigo,
      abonoId: abono.abonoId,
      abonoCodigo: abono.abonoCodigo,
      classification: abono.classification,
      fecha: abono.fecha,
      eventosAntes: abono.eventosAntes,
      eventosDespues: abono.eventosDespues,
    })));
}

/** Validates continuity independently from the report's classifications. */
function validateCandidateChains(candidates) {
  const byCredit = new Map();
  for (const item of candidates) {
    const chain = byCredit.get(item.creditoId) ?? [];
    chain.push(item);
    byCredit.set(item.creditoId, chain);
  }
  for (const chain of byCredit.values()) {
    chain.sort((left, right) => new Date(left.fecha) - new Date(right.fecha));
    for (let index = 0; index < chain.length - 1; index += 1) {
      const current = chain[index];
      for (const after of current.eventosDespues) {
        const next = chain.slice(index + 1).find((item) =>
          item.eventosAntes.some((before) => before.id === after.id));
        if (!next) continue;
        const nextBefore = next.eventosAntes.find((before) => before.id === after.id);
        if (!coreImageEquivalent(after, nextBefore)) {
          throw new Error(`SOURCE_CHAIN_DISCONTINUITY:${current.abonoCodigo}:${after.id}`);
        }
      }
    }
  }
}

async function validateAndPlanCandidate(client, candidate, candidates) {
  const result = {
    creditoId: candidate.creditoId,
    creditoCodigo: candidate.creditoCodigo,
    abonoEventoId: candidate.abonoId,
    abonoCodigo: candidate.abonoCodigo,
    classification: candidate.classification,
    status: "PLANNED",
    creditoAntes: null,
    eventosAntes: candidate.eventosAntes,
    eventosDespues: candidate.eventosDespues,
    aplicadoEn: candidate.fecha,
    reasons: [],
  };

  const { rows: abonos } = await client.query(`
    SELECT ef.id, ef."creditoId", ef.tipo::text, snapshot.id AS "snapshotId"
    FROM eventos_financieros ef
    LEFT JOIN abono_snapshots snapshot ON snapshot."abonoEventoId" = ef.id
    WHERE ef.id = $1
    FOR UPDATE OF ef
  `, [candidate.abonoId]);
  const abono = abonos[0];
  if (!abono || abono.creditoId !== candidate.creditoId || abono.tipo !== "ABONO_CAPITAL") {
    result.status = "DISCREPANCY";
    result.reasons.push("ABONO_MISSING_OR_INVALID");
    return result;
  }
  if (abono.snapshotId) {
    result.status = "EXISTING";
    result.existingSnapshotId = abono.snapshotId;
    return result;
  }

  const ids = [...new Set([
    ...candidate.eventosAntes.map((item) => item.id),
    ...candidate.eventosDespues.map((item) => item.id),
  ])];
  const { rows: events } = await client.query(`
    SELECT id, "creditoId", tipo::text, "valorProgramado"::text,
      "capitalProgramado"::text, "interesProgramado"::text, estado::text
    FROM eventos_financieros
    WHERE id = ANY($1::text[])
    FOR UPDATE
  `, [ids]);
  if (events.length !== ids.length || events.some((item) =>
    item.creditoId !== candidate.creditoId || item.tipo !== "CUOTA_PROGRAMADA")) {
    result.status = "DISCREPANCY";
    result.reasons.push("AFFECTED_INSTALLMENT_MISSING_OR_INVALID");
    return result;
  }

  const lastTouchIds = new Set(candidate.eventosDespues
    .filter((image) => !hasLaterTouch(candidates, candidate, image.id))
    .map((image) => image.id));
  const currentById = new Map(events.map((item) => [item.id, item]));
  for (const expected of candidate.eventosDespues.filter((item) => lastTouchIds.has(item.id))) {
    const current = currentById.get(expected.id);
    if (!coreImageEquivalent(expected, current)) {
      result.status = "DISCREPANCY";
      result.reasons.push(`LAST_POSTIMAGE_CHANGED:${expected.id}`);
    }
  }

  const { rows: credits } = await client.query(`
    SELECT id, estado::text, "fechaCancelacion"
    FROM creditos
    WHERE id = $1
    FOR UPDATE
  `, [candidate.creditoId]);
  const credit = credits[0];
  if (!credit) {
    result.status = "DISCREPANCY";
    result.reasons.push("CREDIT_MISSING");
    return result;
  }
  const hadOutstandingCapital = candidate.eventosAntes.some((item) => Number(item.capitalProgramado) > MONEY_TOLERANCE);
  result.creditoAntes = {
    estado: credit.estado === "CANCELADO" && hadOutstandingCapital ? "ACTIVO" : credit.estado,
    fechaCancelacion: credit.estado === "CANCELADO" && hadOutstandingCapital
      ? null
      : credit.fechaCancelacion?.toISOString?.() ?? credit.fechaCancelacion ?? null,
  };
  return result;
}

function hasLaterTouch(candidates, candidate, eventId) {
  return candidates.some((other) =>
    other.creditoId === candidate.creditoId &&
    new Date(other.fecha).getTime() > new Date(candidate.fecha).getTime() &&
    other.eventosAntes.some((item) => item.id === eventId));
}

async function insertSnapshot(client, result) {
  const id = `hist_abono_${createHash("sha256").update(result.abonoEventoId).digest("hex").slice(0, 24)}`;
  await client.query(`
    INSERT INTO abono_snapshots (
      id, "creditoId", "abonoEventoId", "versionAlgoritmo", "creditoAntes",
      "eventosAntes", "eventosDespues", "aplicadoEn", "creadoEn", "creadoPor"
    ) VALUES ($1, $2, $3, 4, $4::jsonb, $5::jsonb, $6::jsonb, $7::timestamptz, NOW(), $8)
  `, [
    id,
    result.creditoId,
    result.abonoEventoId,
    JSON.stringify(result.creditoAntes),
    JSON.stringify(result.eventosAntes),
    JSON.stringify(result.eventosDespues),
    result.aplicadoEn,
    CREATED_BY,
  ]);
  result.snapshotId = id;
}

function coreImageEquivalent(left, right) {
  if (!left || !right) return false;
  const capitalMatches = moneyEqual(left.capitalProgramado, right.capitalProgramado);
  const valueMatches = moneyEqual(left.valorProgramado, right.valorProgramado) ||
    Math.abs(Number(left.valorProgramado) - Number(right.valorProgramado)) <= LEGACY_SUBPESO_TOLERANCE;
  const interestMatches = moneyEqual(left.interesProgramado, right.interesProgramado) ||
    Math.abs(Number(left.interesProgramado) - Number(right.interesProgramado)) <= LEGACY_SUBPESO_TOLERANCE;
  const cancellationMatches =
    (left.estado === "CANCELADO_POR_ABONO") === (right.estado === "CANCELADO_POR_ABONO");
  return capitalMatches && valueMatches && interestMatches && cancellationMatches;
}

function moneyEqual(left, right) {
  return Math.abs(Number(left) - Number(right)) <= MONEY_TOLERANCE;
}

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}
