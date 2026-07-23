import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const executionDirectory = process.cwd();
const projectRoot = basename(executionDirectory) === "web" ? resolve(executionDirectory, "..") : executionDirectory;
const webRoot = join(projectRoot, "web");
const outputPath = join(webRoot, "scripts/salidas/historical-abonos-backfill-dry-run-v4.json");
const MONEY_TOLERANCE = 0.011;
const LEGACY_SUBPESO_TOLERANCE = 0.15;

function loadEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const databaseUrl = process.env.DATABASE_URL?.trim() || loadEnv(join(projectRoot, ".env.prod")).DATABASE_URL;
if (!databaseUrl) throw new Error("Falta DATABASE_URL en el entorno o en .env.prod.");
const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const { rows } = await client.query(`
    SELECT
      cr.id AS "creditoId",
      cr.codigo AS "creditoCodigo",
      cr.monto::text,
      cr."plazoMeses"::text,
      cr."tasaMensual"::text,
      cr.frecuencia::text,
      cr."tipoAmortizacion"::text,
      cr.estado::text AS "creditoEstado",
      cr."fechaCancelacion",
      ef.id,
      ef.codigo,
      ef."numeroCuota",
      ef.tipo::text,
      ef."fechaProgramada",
      ef."fechaPago",
      ef."valorProgramado"::text,
      ef."capitalProgramado"::text,
      ef."interesProgramado"::text,
      ef."montoPagado"::text,
      ef."capitalPagado"::text,
      ef."interesPagado"::text,
      ef."saldoCapitalPost"::text,
      ef.estado::text,
      ef."diasAtraso",
      ef."creadoEn",
      snapshot.id AS "snapshotId"
    FROM creditos cr
    JOIN eventos_financieros ef ON ef."creditoId" = cr.id
    LEFT JOIN abono_snapshots snapshot ON snapshot."abonoEventoId" = ef.id
    WHERE EXISTS (
      SELECT 1 FROM eventos_financieros abono
      LEFT JOIN abono_snapshots existing ON existing."abonoEventoId" = abono.id
      WHERE abono."creditoId" = cr.id
        AND abono.tipo = 'ABONO_CAPITAL'
        AND existing.id IS NULL
    )
    ORDER BY cr.codigo, ef."numeroCuota" NULLS LAST, ef."creadoEn", ef.id
  `);

  const credits = groupCredits(rows);
  const report = {
    generatedAtUtc: new Date().toISOString(),
    mode: "DRY_RUN_READ_ONLY",
    algorithmVersion: 4,
    policy: {
      moneyTolerance: MONEY_TOLERANCE,
      paidAffectedInstallmentBlocksCurrentReversal: true,
      overdueStatusChangesIgnored: true,
      multipleAbonosSimulatedChronologically: true,
      legacySubpesoTolerance: LEGACY_SUBPESO_TOLERANCE,
      reconstructibleSnapshotsRequireStrictInvariants: true,
      snapshotContinuityValidatedChronologically: true,
      currentRowRequiredOnlyForLastTouchPerInstallment: true,
    },
    summary: {
      credits: credits.length,
      historicalAbonos: 0,
      reconstructible: 0,
      blockedByAffectedPayment: 0,
      nonReconstructible: 0,
    },
    results: [],
  };

  for (const credit of credits) {
    const result = classifyCredit(credit);
    report.results.push(result);
    for (const abono of result.abonos) {
      report.summary.historicalAbonos += 1;
      if (abono.classification === "RECONSTRUIBLE") report.summary.reconstructible += 1;
      else if (abono.classification === "BLOQUEADO_POR_CAMBIO_POSTERIOR") {
        report.summary.blockedByAffectedPayment += 1;
      } else report.summary.nonReconstructible += 1;
    }
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized, "utf8");
  console.log(`Ruta: scripts/salidas/historical-abonos-backfill-dry-run-v4.json`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("[OK] Dry-run completado. No se modificaron datos.");
} finally {
  await client.end();
}

function groupCredits(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.creditoId)) {
      grouped.set(row.creditoId, {
        id: row.creditoId,
        codigo: row.creditoCodigo,
        monto: money(row.monto),
        plazoMeses: Number(row.plazoMeses),
        tasaMensual: Number(row.tasaMensual),
        frecuencia: row.frecuencia,
        tipoAmortizacion: row.tipoAmortizacion,
        estado: row.creditoEstado,
        fechaCancelacion: row.fechaCancelacion,
        eventos: [],
      });
    }
    grouped.get(row.creditoId).eventos.push(normalizeEvent(row));
  }
  return [...grouped.values()];
}

function normalizeEvent(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    numeroCuota: row.numeroCuota,
    tipo: row.tipo,
    fechaProgramada: new Date(row.fechaProgramada),
    fechaPago: row.fechaPago ? new Date(row.fechaPago) : null,
    valorProgramado: money(row.valorProgramado),
    capitalProgramado: money(row.capitalProgramado),
    interesProgramado: money(row.interesProgramado),
    montoPagado: money(row.montoPagado),
    capitalPagado: money(row.capitalPagado),
    interesPagado: money(row.interesPagado),
    saldoCapitalPost: row.saldoCapitalPost === null ? null : money(row.saldoCapitalPost),
    estado: row.estado,
    diasAtraso: row.diasAtraso,
    creadoEn: new Date(row.creadoEn),
    snapshotId: row.snapshotId,
  };
}

function classifyCredit(credit) {
  const installments = credit.eventos
    .filter((event) => event.tipo === "CUOTA_PROGRAMADA")
    .sort((a, b) => a.numeroCuota - b.numeroCuota);
  const abonos = credit.eventos
    .filter((event) => event.tipo === "ABONO_CAPITAL" && !event.snapshotId)
    .sort((a, b) => eventTime(a) - eventTime(b));

  const expectedCount = credit.frecuencia === "MENSUAL"
    ? Math.round(credit.plazoMeses)
    : Math.round(credit.plazoMeses * 2);
  const structuralErrors = [];
  if (
    credit.tipoAmortizacion === "AMORTIZACION_FIJA" &&
    installments.length !== expectedCount
  ) {
    structuralErrors.push(`EXPECTED_${expectedCount}_INSTALLMENTS_FOUND_${installments.length}`);
  }
  if (
    credit.tipoAmortizacion === "SOLO_INTERES" &&
    installments.length < expectedCount
  ) {
    structuralErrors.push(`EXPECTED_AT_LEAST_${expectedCount}_INSTALLMENTS_FOUND_${installments.length}`);
  }
  if (installments.some((event) => !Number.isInteger(event.numeroCuota))) {
    structuralErrors.push("INSTALLMENT_WITHOUT_NUMBER");
  }

  const simulated = buildOriginalSchedule(credit, installments);
  const snapshots = [];

  for (const [abonoIndex, abono] of abonos.entries()) {
    // The first preimage must discard cancellation states inherited from the
    // current database. Later preimages must preserve cancellations produced
    // by earlier simulated abonos so the historical chain remains continuous.
    normalizeScheduleStateBeforeAbono(
      simulated,
      installments,
      abono,
      abonoIndex > 0,
    );
    const before = cloneSchedule(simulated);
    const operationalIds = selectOperationalInstallmentIds(
      credit,
      simulated,
      installments,
      abono,
    );
    const application = credit.tipoAmortizacion === "SOLO_INTERES"
      ? applySoloInteres(simulated, operationalIds, credit, abono.capitalPagado)
      : applyAmortizacionFija(simulated, operationalIds, abono.capitalPagado);

    const affectedIds = application.affectedIds;
    const after = cloneSchedule(simulated);
    snapshots.push({
      abono,
      before: before.filter((item) => affectedIds.has(item.id)),
      after: after.filter((item) => affectedIds.has(item.id)),
      affectedIds: [...affectedIds],
      applicationError: application.error,
    });
  }

  const finalDifferences = compareSimulatedToCurrent(simulated, installments);
  const creditReconstructible = structuralErrors.length === 0 && finalDifferences.length === 0;

  return {
    creditoId: credit.id,
    creditoCodigo: credit.codigo,
    tipoAmortizacion: credit.tipoAmortizacion,
    frecuencia: credit.frecuencia,
    structuralErrors,
    finalScheduleDifferences: finalDifferences,
    abonos: snapshots.map((snapshot, index) => {
      const laterAbonoIds = new Set(
        snapshots.slice(index + 1).flatMap((later) => later.affectedIds),
      );
      const affectedCurrent = installments.filter((item) =>
        snapshot.affectedIds.includes(item.id),
      );
      const currentById = new Map(affectedCurrent.map((item) => [item.id, item]));
      const paidAffected = affectedCurrent.filter(
        (item) => item.fechaPago && item.fechaPago.getTime() > eventTime(snapshot.abono),
      );
      const touchedByLaterAbono = snapshot.affectedIds.filter((id) => laterAbonoIds.has(id));

      let classification = "RECONSTRUIBLE";
      const reasons = [];
      const invariantErrors = validateSnapshotInvariants(
        snapshot,
        index,
        snapshots,
        currentById,
      );
      if (!creditReconstructible || snapshot.applicationError || invariantErrors.length > 0) {
        classification = "NO_RECONSTRUIBLE";
        reasons.push(...structuralErrors, ...finalDifferences.map((item) => item.reason));
        if (snapshot.applicationError) reasons.push(snapshot.applicationError);
        reasons.push(...invariantErrors);
      } else if (paidAffected.length > 0 || touchedByLaterAbono.length > 0) {
        classification = "BLOQUEADO_POR_CAMBIO_POSTERIOR";
        if (paidAffected.length > 0) {
          reasons.push(`AFFECTED_INSTALLMENTS_PAID_AFTER_ABONO:${paidAffected.map((item) => item.numeroCuota).join(",")}`);
        }
        if (touchedByLaterAbono.length > 0) reasons.push("AFFECTED_BY_LATER_ABONO");
      }

      return {
        abonoId: snapshot.abono.id,
        abonoCodigo: snapshot.abono.codigo,
        monto: formatMoney(snapshot.abono.capitalPagado),
        fecha: snapshot.abono.fechaPago?.toISOString() ?? snapshot.abono.creadoEn.toISOString(),
        classification,
        reasons: [...new Set(reasons)],
        affectedInstallmentNumbers: affectedCurrent.map((item) => item.numeroCuota),
        eventosAntes: snapshot.before.map(toImage),
        eventosDespues: snapshot.after.map((item) => {
          const current = currentById.get(item.id);
          // For a currently reversible historical abono, the exact stored row
          // is the authoritative postimage, including legacy saldo metadata.
          return toImage(
            current && classification === "RECONSTRUIBLE" ? current : item,
          );
        }),
      };
    }),
  };
}

function buildOriginalSchedule(credit, installments) {
  const count = installments.length;
  const rate = credit.frecuencia === "MENSUAL"
    ? credit.tasaMensual
    : credit.tasaMensual / 2;
  const result = [];

  if (credit.tipoAmortizacion === "SOLO_INTERES") {
    const interest = roundMoney(credit.monto * rate);
    for (let index = 0; index < count; index += 1) {
      const last = index === count - 1;
      result.push(baseImage(installments[index], {
        capitalProgramado: last ? credit.monto : 0,
        interesProgramado: interest,
        valorProgramado: interest + (last ? credit.monto : 0),
        saldoCapitalPost: last ? 0 : credit.monto,
      }));
    }
    return result;
  }

  const regularCapital = roundMoney(credit.monto / count);
  const interest = roundMoney(credit.monto * rate);
  let remaining = credit.monto;
  for (let index = 0; index < count; index += 1) {
    const last = index === count - 1;
    const capital = last ? remaining : Math.min(regularCapital, remaining);
    remaining = roundMoney(Math.max(0, remaining - capital));
    result.push(baseImage(installments[index], {
      capitalProgramado: capital,
      interesProgramado: interest,
      valorProgramado: capital + interest,
      saldoCapitalPost: remaining,
    }));
  }
  return result;
}

function baseImage(event, values) {
  return {
    id: event.id,
    numeroCuota: event.numeroCuota,
    fechaProgramada: event.fechaProgramada,
    fechaPago: event.fechaPago,
    montoPagado: event.montoPagado,
    capitalPagado: event.capitalPagado,
    interesPagado: event.interesPagado,
    estado: event.estado,
    diasAtraso: event.diasAtraso,
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, roundMoney(value)]),
    ),
  };
}

/**
 * Selects installments that were eligible when the historical abono occurred.
 * For SOLO_INTERES, future unpaid installments are preferred. If the schedule
 * had already matured, unpaid capital-bearing installments remain eligible.
 */
function selectOperationalInstallmentIds(credit, schedule, current, abono) {
  const cutoff = eventDate(abono).getTime();
  const currentById = new Map(current.map((item) => [item.id, item]));
  const unpaid = schedule.filter((item) => {
    const actual = currentById.get(item.id);
    return !wasPaidBy(actual ?? item, abono);
  });

  if (credit.tipoAmortizacion !== "SOLO_INTERES") {
    return new Set(unpaid.map((item) => item.id));
  }

  const future = unpaid.filter(
    (item) => item.fechaProgramada.getTime() >= cutoff,
  );
  if (future.length > 0) return new Set(future.map((item) => item.id));

  const maturedCapitalBearing = unpaid.filter(
    (item) => item.capitalProgramado > MONEY_TOLERANCE,
  );
  return new Set(maturedCapitalBearing.map((item) => item.id));
}

function applyAmortizacionFija(schedule, operationalIds, amount) {
  let remaining = amount;
  const affectedIds = new Set();
  for (const installment of [...schedule].reverse()) {
    if (!operationalIds.has(installment.id) || remaining <= MONEY_TOLERANCE) continue;
    affectedIds.add(installment.id);
    if (remaining + MONEY_TOLERANCE >= installment.capitalProgramado) {
      remaining = roundMoney(remaining - installment.capitalProgramado);
      installment.capitalProgramado = 0;
      installment.interesProgramado = 0;
      installment.valorProgramado = 0;
      installment.estado = "CANCELADO_POR_ABONO";
      installment.diasAtraso = 0;
    } else {
      installment.capitalProgramado = roundMoney(installment.capitalProgramado - remaining);
      installment.valorProgramado = roundMoney(
        installment.capitalProgramado + installment.interesProgramado,
      );
      remaining = 0;
    }
  }
  return {
    affectedIds,
    error: remaining > MONEY_TOLERANCE ? `UNAPPLIED_ABONO_REMAINDER:${formatMoney(remaining)}` : null,
  };
}

function applySoloInteres(schedule, operationalIds, credit, amount) {
  const operational = schedule.filter((item) => operationalIds.has(item.id));
  const affectedIds = new Set(operational.map((item) => item.id));
  const currentCapital = operational.reduce(
    (total, item) => total + item.capitalProgramado,
    0,
  );
  const newCapital = roundMoney(Math.max(0, currentCapital - amount));
  if (newCapital === 0) {
    for (const item of operational) {
      item.capitalProgramado = 0;
      item.interesProgramado = 0;
      item.valorProgramado = 0;
      item.estado = "CANCELADO_POR_ABONO";
      item.diasAtraso = 0;
    }
    return { affectedIds, error: null };
  }

  const rate = credit.frecuencia === "MENSUAL"
    ? credit.tasaMensual
    : credit.tasaMensual / 2;
  const interest = roundMoney(newCapital * rate);
  const lastId = operational.at(-1)?.id;
  for (const item of operational) {
    const capital = item.id === lastId ? newCapital : 0;
    item.capitalProgramado = capital;
    item.interesProgramado = interest;
    item.valorProgramado = roundMoney(capital + interest);
  }
  return { affectedIds, error: null };
}

function recalculateProjectedBalances(schedule, initialAmount, installments, abonos, throughAbono) {
  const paidCapitalThroughDate = installments
    .filter((item) => item.fechaPago && item.fechaPago <= eventDate(throughAbono))
    .reduce((sum, item) => sum + item.capitalPagado, 0);
  const abonoCapitalThroughDate = abonos
    .filter((item) => eventTime(item) <= eventTime(throughAbono))
    .reduce((sum, item) => sum + item.capitalPagado, 0);
  let projected = roundMoney(Math.max(0, initialAmount - paidCapitalThroughDate - abonoCapitalThroughDate));
  for (const item of schedule) {
    if (item.fechaPago && item.fechaPago <= eventDate(throughAbono)) continue;
    projected = roundMoney(Math.max(0, projected - item.capitalProgramado));
    item.saldoCapitalPost = projected;
  }
}

/**
 * Restores the operational state that existed immediately before the abono.
 * Existing payments are preserved; canceled states from later abonos are not.
 */
function normalizeScheduleStateBeforeAbono(
  schedule,
  current,
  abono,
  preservePriorAbonoCancellations,
) {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const cutoff = eventDate(abono).getTime();
  for (const item of schedule) {
    const actual = currentById.get(item.id);
    if (actual?.fechaPago && actual.fechaPago.getTime() <= cutoff) {
      item.estado = "PAGADO";
      item.fechaPago = actual.fechaPago;
      item.montoPagado = actual.montoPagado;
      item.capitalPagado = actual.capitalPagado;
      item.interesPagado = actual.interesPagado;
      continue;
    }
    item.fechaPago = null;
    item.montoPagado = 0;
    item.capitalPagado = 0;
    item.interesPagado = 0;
    if (
      preservePriorAbonoCancellations &&
      item.estado === "CANCELADO_POR_ABONO"
    ) {
      continue;
    }
    item.estado = item.fechaProgramada.getTime() < cutoff ? "ATRASADO" : "PENDIENTE";
  }
}

function compareSimulatedToCurrent(simulated, current) {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const differences = [];
  for (const expected of simulated) {
    const actual = currentById.get(expected.id);
    if (!actual) {
      differences.push({ eventId: expected.id, reason: "MISSING_CURRENT_INSTALLMENT" });
      continue;
    }
    // saldoCapitalPost is legacy projection metadata and is not proof of the
    // financial effect of an abono. Core scheduled amounts are authoritative.
    for (const field of [
      "valorProgramado",
      "capitalProgramado",
      "interesProgramado",
    ]) {
      const difference = Math.abs(expected[field] - actual[field]);
      const isAllowedLegacyResidual =
        (field === "valorProgramado" || field === "interesProgramado") &&
        moneyEqual(expected.capitalProgramado, actual.capitalProgramado) &&
        difference <= LEGACY_SUBPESO_TOLERANCE;
      if (!moneyEqual(expected[field], actual[field]) && !isAllowedLegacyResidual) {
        differences.push({
          eventId: expected.id,
          numeroCuota: expected.numeroCuota,
          reason: `FINAL_${field}_MISMATCH`,
          expected: formatMoney(expected[field]),
          actual: actual[field] === null ? null : formatMoney(actual[field]),
        });
      }
    }
    const expectedCanceled = expected.estado === "CANCELADO_POR_ABONO";
    const actualCanceled = actual.estado === "CANCELADO_POR_ABONO";
    if (expectedCanceled !== actualCanceled) {
      differences.push({
        eventId: expected.id,
        numeroCuota: expected.numeroCuota,
        reason: "FINAL_CANCELLATION_STATE_MISMATCH",
        expected: expected.estado,
        actual: actual.estado,
      });
    }
  }
  return differences;
}

/**
 * Enforces conditions required before a result may be called reconstructible.
 * These checks are intentionally strict because the next phase writes data.
 */
function validateSnapshotInvariants(
  snapshot,
  snapshotIndex,
  snapshots,
  currentById,
) {
  const errors = [];
  if (snapshot.affectedIds.length === 0) errors.push("INVARIANT_EMPTY_AFFECTED_INSTALLMENTS");
  if (snapshot.before.length === 0) errors.push("INVARIANT_EMPTY_PREIMAGE");
  if (snapshot.after.length === 0) errors.push("INVARIANT_EMPTY_POSTIMAGE");
  if (snapshot.before.some((item) => item.estado === "CANCELADO_POR_ABONO")) {
    // A cancellation produced by an earlier historical abono is valid only for
    // chained snapshots. The first historical preimage can never be canceled.
    const hasEarlierTouch = snapshot.before.some((item) =>
      snapshots.slice(0, snapshotIndex).some((earlier) =>
        earlier.affectedIds.includes(item.id),
      ),
    );
    if (!hasEarlierTouch) errors.push("INVARIANT_PREIMAGE_CANCELLED_WITHOUT_EARLIER_ABONO");
  }
  if (imagesEquivalent(snapshot.before, snapshot.after)) {
    errors.push("INVARIANT_IDENTICAL_PRE_AND_POST_IMAGES");
  }

  for (const item of snapshot.after) {
    const nextTouch = snapshots
      .slice(snapshotIndex + 1)
      .find((later) => later.affectedIds.includes(item.id));

    if (nextTouch) {
      const nextPreimage = nextTouch.before.find((candidate) => candidate.id === item.id);
      if (!nextPreimage) {
        errors.push(`INVARIANT_NEXT_PREIMAGE_MISSING:${item.id}`);
      } else if (!coreImageEquivalent(item, nextPreimage)) {
        errors.push(`INVARIANT_CHAIN_DISCONTINUITY:${item.id}`);
      }
      continue;
    }

    const current = currentById.get(item.id);
    if (!current) {
      errors.push(`INVARIANT_POSTIMAGE_MISSING_CURRENT:${item.id}`);
    } else if (!coreImageEquivalent(item, current)) {
      errors.push(`INVARIANT_LAST_POSTIMAGE_DIFFERS_FROM_CURRENT:${item.id}`);
    }
  }
  return [...new Set(errors)];
}

function imagesEquivalent(left, right) {
  if (left.length !== right.length) return false;
  const rightById = new Map(right.map((item) => [item.id, item]));
  return left.every((item) => {
    const other = rightById.get(item.id);
    return other && coreImageEquivalent(item, other);
  });
}

function coreImageEquivalent(left, right) {
  const capitalMatches = moneyEqual(
    left.capitalProgramado,
    right.capitalProgramado,
  );
  if (!capitalMatches) return false;

  const valueMatches = moneyEqual(left.valorProgramado, right.valorProgramado) ||
    Math.abs(left.valorProgramado - right.valorProgramado) <= LEGACY_SUBPESO_TOLERANCE;
  const interestMatches = moneyEqual(left.interesProgramado, right.interesProgramado) ||
    Math.abs(left.interesProgramado - right.interesProgramado) <= LEGACY_SUBPESO_TOLERANCE;
  const cancellationMatches =
    (left.estado === "CANCELADO_POR_ABONO") ===
    (right.estado === "CANCELADO_POR_ABONO");

  return valueMatches && interestMatches && cancellationMatches;
}

function wasPaidBy(installment, abono) {
  return Boolean(
    installment.fechaPago && installment.fechaPago.getTime() <= eventDate(abono).getTime(),
  );
}

function eventDate(event) {
  return event.fechaPago ?? event.creadoEn;
}

function eventTime(event) {
  return eventDate(event).getTime();
}

function cloneSchedule(schedule) {
  return schedule.map((item) => ({ ...item }));
}

function toImage(item) {
  return {
    id: item.id,
    numeroCuota: item.numeroCuota,
    fechaProgramada: item.fechaProgramada.toISOString(),
    fechaPago: item.fechaPago?.toISOString() ?? null,
    valorProgramado: formatMoney(item.valorProgramado),
    capitalProgramado: formatMoney(item.capitalProgramado),
    interesProgramado: formatMoney(item.interesProgramado),
    montoPagado: formatMoney(item.montoPagado),
    capitalPagado: formatMoney(item.capitalPagado),
    interesPagado: formatMoney(item.interesPagado),
    saldoCapitalPost: item.saldoCapitalPost === null ? null : formatMoney(item.saldoCapitalPost),
    estado: item.estado,
    diasAtraso: item.diasAtraso,
  };
}

function money(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Valor monetario invalido: ${value}`);
  return roundMoney(parsed);
}

function moneyEqual(left, right) {
  if (left === null || right === null) return left === right;
  return Math.abs(Number(left) - Number(right)) <= MONEY_TOLERANCE;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatMoney(value) {
  return roundMoney(value).toFixed(2);
}
