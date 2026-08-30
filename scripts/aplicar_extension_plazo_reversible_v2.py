#!/usr/bin/env python3
"""Implement safe and reversible Solo Interest term extensions in Lopest.

The applicator is transactional at the filesystem level: it validates all
anchors before writing, creates an additive Prisma migration, and leaves no
backup files. Runtime mutations are implemented transactionally in the app.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
SCHEMA = WEB / "prisma/schema.prisma"
ACTIONS = WEB / "src/features/creditos/plazos/actions.ts"
PAGE = WEB / "src/app/(dashboard)/creditos/[id]/page.tsx"
QUERY = WEB / "src/features/creditos/queries.ts"
STATE = WEB / "src/features/creditos/plazos/extension-state.ts"
POLICY = WEB / "src/features/creditos/plazos/extension-policy.ts"
FORM = WEB / "src/features/creditos/plazos/extension-term-form.tsx"
TEST = WEB / "src/features/creditos/plazos/__tests__/extension-policy.test.ts"
MIGRATION = WEB / "prisma/migrations/20260818003000_extension_plazo_snapshots/migration.sql"


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def main() -> int:
    for path in (SCHEMA, ACTIONS, PAGE, QUERY):
        if not path.is_file():
            raise SystemExit(f"ERROR: missing {path.relative_to(ROOT)}")
    for path in (STATE, POLICY, FORM, TEST, MIGRATION):
        if path.exists():
            raise SystemExit(f"ERROR: target already exists: {path.relative_to(ROOT)}")

    schema = SCHEMA.read_text(encoding="utf-8")
    page = PAGE.read_text(encoding="utf-8")
    query = QUERY.read_text(encoding="utf-8")
    current_actions = ACTIONS.read_text(encoding="utf-8")

    if "No se puede extender el plazo porque el crédito ya tiene movimientos financieros." not in current_actions:
        raise SystemExit("ERROR: expected legacy extension block was not found")

    schema_next = once(
        schema,
        "  abonoSnapshots   AbonoSnapshot[]\n",
        "  abonoSnapshots      AbonoSnapshot[]\n  extensionSnapshots ExtensionPlazoSnapshot[]\n",
        "Credit snapshot relation",
    )
    schema_next = once(
        schema_next,
        "model SecuenciaCredito {",
        '''model ExtensionPlazoSnapshot {
  id String @id @default(cuid())
  creditoId String
  credito   Credito @relation(fields: [creditoId], references: [id], onDelete: Cascade)

  versionAlgoritmo Int @default(1)
  creditoAntes     Json
  creditoDespues   Json
  eventosAntes     Json
  eventosDespues   Json
  eventosCreados   Json
  aplicadoEn       DateTime
  creadoEn         DateTime @default(now())
  creadoPor        String
  revertidoEn      DateTime?
  revertidoPor     String?
  motivoReversion  String?

  @@index([creditoId])
  @@index([aplicadoEn])
  @@index([revertidoEn])
  @@map("extension_plazo_snapshots")
}

model SecuenciaCredito {''',
        "Extension snapshot model",
    )

    query_next = once(
        query,
        "      eventos: {\n        include: {\n          abonoSnapshot: true,\n        },",
        "      extensionSnapshots: {\n        where: { revertidoEn: null },\n        orderBy: { aplicadoEn: \"desc\" },\n        take: 1,\n      },\n      eventos: {\n        include: {\n          abonoSnapshot: true,\n        },",
        "Detail snapshot include",
    )

    page_next = once(
        page,
        'import { extenderPlazoSoloInteres } from "@/features/creditos/plazos/actions";\n',
        'import { ExtensionTermForm } from "@/features/creditos/plazos/extension-term-form";\n',
        "Extension form import",
    )
    old_section = '''            <form action={extenderPlazoSoloInteres} className={styles.extensionForm}>
              <input type="hidden" name="creditoId" value={credito.id} />

              <label className={styles.formField}>
                <span className={formRecipes.label}>
                  Cuotas extra
                </span>
                <input
                  name="cuotasExtra"
                  inputMode="numeric"
                  placeholder="Ej: 2"
                  className={formRecipes.control}
                />
              </label>

              <button
                type="submit"
                className={actionRecipes.secondary}
              >
                Extender
              </button>
            </form>'''
    new_section = '''            <ExtensionTermForm
              creditoId={credito.id}
              reversibleSnapshotId={credito.extensionSnapshots[0]?.id ?? null}
            />'''
    page_next = once(page_next, old_section, new_section, "Legacy extension form")

    migration = '''CREATE TABLE "extension_plazo_snapshots" (
  "id" TEXT NOT NULL,
  "creditoId" TEXT NOT NULL,
  "versionAlgoritmo" INTEGER NOT NULL DEFAULT 1,
  "creditoAntes" JSONB NOT NULL,
  "creditoDespues" JSONB NOT NULL,
  "eventosAntes" JSONB NOT NULL,
  "eventosDespues" JSONB NOT NULL,
  "eventosCreados" JSONB NOT NULL,
  "aplicadoEn" TIMESTAMP(3) NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPor" TEXT NOT NULL,
  "revertidoEn" TIMESTAMP(3),
  "revertidoPor" TEXT,
  "motivoReversion" TEXT,
  CONSTRAINT "extension_plazo_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "extension_plazo_snapshots_creditoId_idx" ON "extension_plazo_snapshots"("creditoId");
CREATE INDEX "extension_plazo_snapshots_aplicadoEn_idx" ON "extension_plazo_snapshots"("aplicadoEn");
CREATE INDEX "extension_plazo_snapshots_revertidoEn_idx" ON "extension_plazo_snapshots"("revertidoEn");
ALTER TABLE "extension_plazo_snapshots"
  ADD CONSTRAINT "extension_plazo_snapshots_creditoId_fkey"
  FOREIGN KEY ("creditoId") REFERENCES "creditos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
'''

    state_source = '''export interface ExtensionTermState {
  ok: boolean;
  message: string | null;
}

export const initialExtensionTermState: ExtensionTermState = {
  ok: false,
  message: null,
};
'''

    policy_source = '''export interface OperationalInstallment {
  id: string;
  numeroCuota: number | null;
  estado: string;
}

export function isOperationalUnpaidState(state: string): boolean {
  return state === "PENDIENTE" || state === "ATRASADO" || state === "MORA";
}

/** Recalculates money only. Dates, numbers and operational states remain immutable. */
export function recalcularCuotasSoloInteres(input: {
  saldoCapital: number;
  tasaMensual: number;
  frecuencia: string;
  cuotas: OperationalInstallment[];
}) {
  const cuotas = [...input.cuotas]
    .filter((cuota) => isOperationalUnpaidState(cuota.estado))
    .sort((a, b) => Number(a.numeroCuota ?? 0) - Number(b.numeroCuota ?? 0));
  if (cuotas.length === 0) throw new Error("El crédito no tiene cuotas pendientes para extender.");
  if (!(input.saldoCapital > 0)) throw new Error("El crédito no tiene capital pendiente para extender.");
  const tasaPeriodo = input.frecuencia === "MENSUAL" ? input.tasaMensual : input.tasaMensual / 2;
  const interes = input.saldoCapital * tasaPeriodo;
  return cuotas.map((cuota) => ({
    id: cuota.id,
    numeroCuota: cuota.numeroCuota,
    interesProgramado: interes,
    capitalProgramado: 0,
    valorProgramado: interes,
    saldoCapitalPost: input.saldoCapital,
  }));
}

export function incrementoPlazoMeses(cuotasExtra: number, frecuencia: string): number {
  return frecuencia === "MENSUAL" ? cuotasExtra : cuotasExtra / 2;
}
'''

    actions_source = r'''"use server";
import { revalidatePath } from "next/cache";
import {
  EstadoCredito,
  EstadoEventoFinanciero,
  FrecuenciaPago,
  TipoAmortizacion,
  TipoEventoFinanciero,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularSaldoCapitalActual } from "@/features/creditos/current-capital-balance";
import { toFinancialEventImage, toSnapshotJson, financialImageMatches, type FinancialEventImage } from "@/features/creditos/abonos/snapshot";
import { recordAuditLogTx } from "@/server/audit/audit-log";
import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";
import { incrementoPlazoMeses, recalcularCuotasSoloInteres } from "./extension-policy";
import type { ExtensionTermState } from "./extension-state";

interface SnapshotCreditImage {
  plazoMeses: string;
  estado: EstadoCredito;
  fechaCancelacion: string | null;
}

function money(value: number): string { return value.toFixed(2); }
function required(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`Falta el campo obligatorio ${name}.`);
  return value.trim();
}
function optional(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}
function colombiaToday(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return new Date(Number(parts.find((p) => p.type === "year")?.value), Number(parts.find((p) => p.type === "month")?.value) - 1, Number(parts.find((p) => p.type === "day")?.value));
}
function nextDate(date: Date, frequency: FrecuenciaPago): Date {
  const next = new Date(date);
  if (frequency === FrecuenciaPago.MENSUAL) next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + 15);
  return next;
}
function stateByDate(date: Date, today: Date): EstadoEventoFinanciero {
  return date.getTime() < today.getTime() ? EstadoEventoFinanciero.ATRASADO : EstadoEventoFinanciero.PENDIENTE;
}

export async function extenderPlazoSoloInteres(
  _previous: ExtensionTermState,
  formData: FormData,
): Promise<ExtensionTermState> {
  let creditoId = "";
  try {
    creditoId = required(formData, "creditoId");
    const cuotasExtra = Number(required(formData, "cuotasExtra"));
    if (!Number.isInteger(cuotasExtra) || cuotasExtra <= 0 || cuotasExtra > 60) {
      throw new Error("Ingresa un número entero de cuotas extra entre 1 y 60.");
    }
    const { user } = await requireCreditoAccess(creditoId);
    assertCanMutate(user);
    await prisma.$transaction(async (tx) => {
      const credito = await tx.credito.findUnique({ where: { id: creditoId }, include: { eventos: { orderBy: [{ numeroCuota: "asc" }, { creadoEn: "asc" }] }, extensionSnapshots: { where: { revertidoEn: null }, take: 1 } } });
      if (!credito) throw new Error("El crédito no existe.");
      if (credito.estado === EstadoCredito.CANCELADO) throw new Error("No se puede extender un crédito cancelado.");
      if (credito.tipoAmortizacion !== TipoAmortizacion.SOLO_INTERES) throw new Error("Extender plazo solo aplica para créditos de Solo Interés.");
      if (credito.extensionSnapshots.length > 0) throw new Error("Primero debes revertir la extensión vigente antes de aplicar otra.");

      const cuotas = credito.eventos.filter((e) => e.tipo === TipoEventoFinanciero.CUOTA_PROGRAMADA && e.numeroCuota !== null);
      if (cuotas.length === 0) throw new Error("El crédito no tiene cuotas programadas para extender.");
      const saldo = calcularSaldoCapitalActual(credito.monto, credito.eventos);
      const recalculadas = recalcularCuotasSoloInteres({ saldoCapital: saldo, tasaMensual: Number(credito.tasaMensual), frecuencia: credito.frecuencia, cuotas });
      const beforeById = new Map(cuotas.map((event) => [event.id, toFinancialEventImage(event)]));
      for (const cuota of recalculadas) {
        await tx.eventoFinanciero.update({ where: { id: cuota.id }, data: { interesProgramado: money(cuota.interesProgramado), capitalProgramado: "0.00", valorProgramado: money(cuota.valorProgramado), saldoCapitalPost: money(cuota.saldoCapitalPost), accionPor: user.id } });
      }

      const last = [...cuotas].sort((a, b) => Number(b.numeroCuota) - Number(a.numeroCuota))[0];
      const maxNumber = Number(last.numeroCuota);
      const periodRate = credito.frecuencia === FrecuenciaPago.MENSUAL ? Number(credito.tasaMensual) : Number(credito.tasaMensual) / 2;
      const interest = saldo * periodRate;
      const today = colombiaToday();
      let date = new Date(last.fechaProgramada);
      const created = [];
      for (let index = 1; index <= cuotasExtra; index++) {
        date = nextDate(date, credito.frecuencia);
        const final = index === cuotasExtra;
        const event = await tx.eventoFinanciero.create({ data: { codigo: `${credito.codigo}-C${maxNumber + index}`, creditoId, numeroCuota: maxNumber + index, tipo: TipoEventoFinanciero.CUOTA_PROGRAMADA, fechaProgramada: new Date(date), fechaPago: null, valorProgramado: money(interest + (final ? saldo : 0)), capitalProgramado: money(final ? saldo : 0), interesProgramado: money(interest), montoPagado: "0.00", capitalPagado: "0.00", interesPagado: "0.00", saldoCapitalPost: money(final ? 0 : saldo), estado: stateByDate(date, today), diasAtraso: 0, accionPor: user.id } });
        created.push(event);
      }
      const updatedExisting = await tx.eventoFinanciero.findMany({ where: { id: { in: recalculadas.map((c) => c.id) } }, orderBy: { numeroCuota: "asc" } });
      const newTerm = Number(credito.plazoMeses) + incrementoPlazoMeses(cuotasExtra, credito.frecuencia);
      await tx.credito.update({ where: { id: creditoId }, data: { plazoMeses: money(newTerm), estado: EstadoCredito.ACTIVO, fechaCancelacion: null, accionPor: user.id } });
      const snapshot = await tx.extensionPlazoSnapshot.create({ data: { creditoId, versionAlgoritmo: 1, creditoAntes: { plazoMeses: String(credito.plazoMeses), estado: credito.estado, fechaCancelacion: credito.fechaCancelacion?.toISOString() ?? null }, creditoDespues: { plazoMeses: money(newTerm), estado: EstadoCredito.ACTIVO, fechaCancelacion: null }, eventosAntes: toSnapshotJson(recalculadas.map((c) => beforeById.get(c.id)).filter((v): v is FinancialEventImage => Boolean(v))), eventosDespues: toSnapshotJson(updatedExisting.map(toFinancialEventImage)), eventosCreados: toSnapshotJson(created.map(toFinancialEventImage)), aplicadoEn: new Date(), creadoPor: user.id } });
      await recordAuditLogTx(tx, { actorId: user.id, action: "EXTENSION_PLAZO_APPLY", entityType: "ExtensionPlazoSnapshot", entityId: snapshot.id, before: snapshot.creditoAntes as Prisma.InputJsonValue, after: snapshot.creditoDespues as Prisma.InputJsonValue, metadata: { creditoId, cuotasExtra, createdEventIds: created.map((e) => e.id), versionAlgoritmo: 1 } });
    });
    revalidatePath("/creditos"); revalidatePath(`/creditos/${creditoId}`);
    return { ok: true, message: "El plazo se extendió correctamente." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function reversarExtensionPlazo(
  _previous: ExtensionTermState,
  formData: FormData,
): Promise<ExtensionTermState> {
  let creditoId = "";
  try {
    creditoId = required(formData, "creditoId");
    const snapshotId = required(formData, "snapshotId");
    const reason = optional(formData, "motivo");
    if (reason.length > 500) throw new Error("El motivo no puede superar 500 caracteres.");
    const { user } = await requireCreditoAccess(creditoId);
    assertCanMutate(user);
    await prisma.$transaction(async (tx) => {
      const snapshot = await tx.extensionPlazoSnapshot.findUnique({ where: { id: snapshotId } });
      if (!snapshot || snapshot.creditoId !== creditoId || snapshot.revertidoEn) throw new Error("La extensión no existe, no pertenece al crédito o ya fue revertida.");
      const expectedExisting = snapshot.eventosDespues as unknown as FinancialEventImage[];
      const expectedCreated = snapshot.eventosCreados as unknown as FinancialEventImage[];
      const ids = [...expectedExisting, ...expectedCreated].map((e) => e.id);
      const current = await tx.eventoFinanciero.findMany({ where: { id: { in: ids } } });
      const currentById = new Map(current.map((event) => [event.id, event]));
      const unchanged = [...expectedExisting, ...expectedCreated].every((expected) => {
        const event = currentById.get(expected.id);
        return event ? financialImageMatches(event, expected) : false;
      });
      if (!unchanged) throw new Error("La extensión no puede revertirse porque una cuota afectada ya cambió o recibió un pago.");
      const laterAbono = await tx.eventoFinanciero.findFirst({ where: { creditoId, tipo: TipoEventoFinanciero.ABONO_CAPITAL, estado: EstadoEventoFinanciero.PAGADO, creadoEn: { gt: snapshot.aplicadoEn } } });
      if (laterAbono) throw new Error("La extensión no puede revertirse porque existe un abono posterior.");

      const beforeEvents = snapshot.eventosAntes as unknown as FinancialEventImage[];
      for (const event of beforeEvents) {
        await tx.eventoFinanciero.update({ where: { id: event.id }, data: { fechaProgramada: new Date(event.fechaProgramada), fechaPago: event.fechaPago ? new Date(event.fechaPago) : null, valorProgramado: event.valorProgramado, capitalProgramado: event.capitalProgramado, interesProgramado: event.interesProgramado, montoPagado: event.montoPagado, capitalPagado: event.capitalPagado, interesPagado: event.interesPagado, saldoCapitalPost: event.saldoCapitalPost, estado: event.estado as EstadoEventoFinanciero, diasAtraso: event.diasAtraso, accionPor: user.id } });
      }
      await tx.eventoFinanciero.deleteMany({ where: { id: { in: expectedCreated.map((e) => e.id) } } });
      const creditBefore = snapshot.creditoAntes as unknown as SnapshotCreditImage;
      await tx.credito.update({ where: { id: creditoId }, data: { plazoMeses: creditBefore.plazoMeses, estado: creditBefore.estado, fechaCancelacion: creditBefore.fechaCancelacion ? new Date(creditBefore.fechaCancelacion) : null, accionPor: user.id } });
      await tx.extensionPlazoSnapshot.update({ where: { id: snapshot.id }, data: { revertidoEn: new Date(), revertidoPor: user.id, motivoReversion: reason || null } });
      await recordAuditLogTx(tx, { actorId: user.id, action: "EXTENSION_PLAZO_REVERSE", entityType: "ExtensionPlazoSnapshot", entityId: snapshot.id, reason: reason || null, before: snapshot.creditoDespues as Prisma.InputJsonValue, after: snapshot.creditoAntes as Prisma.InputJsonValue, metadata: { creditoId, deletedEventIds: expectedCreated.map((e) => e.id), versionAlgoritmo: snapshot.versionAlgoritmo } });
    });
    revalidatePath("/creditos"); revalidatePath(`/creditos/${creditoId}`);
    return { ok: true, message: "La última extensión se revirtió correctamente." };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
'''

    form_source = '''"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { extenderPlazoSoloInteres, reversarExtensionPlazo } from "./actions";
import { initialExtensionTermState } from "./extension-state";

export function ExtensionTermForm({ creditoId, reversibleSnapshotId }: { creditoId: string; reversibleSnapshotId: string | null }) {
  const router = useRouter();
  const [extendState, extendAction, extending] = useActionState(extenderPlazoSoloInteres, initialExtensionTermState);
  const [reverseState, reverseAction, reversing] = useActionState(reversarExtensionPlazo, initialExtensionTermState);
  useEffect(() => { if (extendState.ok || reverseState.ok) router.refresh(); }, [extendState.ok, reverseState.ok, router]);
  const feedback = reverseState.message ?? extendState.message;
  const success = reverseState.message ? reverseState.ok : extendState.ok;
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto">
      <form action={extendAction} className="flex w-full flex-col gap-2 sm:min-w-80 sm:flex-row sm:items-end">
        <input type="hidden" name="creditoId" value={creditoId} />
        <label className="min-w-0 flex-1"><span className={formRecipes.label}>Cuotas extra</span><input name="cuotasExtra" inputMode="numeric" placeholder="Ej: 2" required disabled={extending || Boolean(reversibleSnapshotId)} className={formRecipes.control} /></label>
        <button type="submit" disabled={extending || Boolean(reversibleSnapshotId)} className={actionRecipes.secondary}>{extending ? "Extendiendo..." : "Extender"}</button>
      </form>
      {reversibleSnapshotId ? (
        <form action={reverseAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="creditoId" value={creditoId} /><input type="hidden" name="snapshotId" value={reversibleSnapshotId} />
          <label className="min-w-0 flex-1"><span className={formRecipes.label}>Motivo de reversión (opcional)</span><input name="motivo" maxLength={500} disabled={reversing} className={formRecipes.control} /></label>
          <button type="submit" disabled={reversing} className={actionRecipes.destructive}>{reversing ? "Revirtiendo..." : "Revertir última extensión"}</button>
        </form>
      ) : null}
      {feedback ? <p role="status" className={success ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{feedback}</p> : null}
    </div>
  );
}
'''

    test_source = '''import { describe, expect, it } from "vitest";
import { incrementoPlazoMeses, recalcularCuotasSoloInteres } from "../extension-policy";

describe("extensión segura de plazo", () => {
  it("recalcula únicamente cuotas operativas y conserva sus identificadores", () => {
    const result = recalcularCuotasSoloInteres({ saldoCapital: 2_000_000, tasaMensual: 0.15, frecuencia: "MENSUAL", cuotas: [
      { id: "paid", numeroCuota: 1, estado: "PAGADO" },
      { id: "late", numeroCuota: 2, estado: "ATRASADO" },
      { id: "future", numeroCuota: 3, estado: "PENDIENTE" },
    ] });
    expect(result.map((item) => item.id)).toEqual(["late", "future"]);
    expect(result.every((item) => item.interesProgramado === 300_000 && item.capitalProgramado === 0 && item.saldoCapitalPost === 2_000_000)).toBe(true);
  });
  it("usa la mitad de la tasa mensual para frecuencias quincenales", () => {
    const result = recalcularCuotasSoloInteres({ saldoCapital: 1_000_000, tasaMensual: 0.1, frecuencia: "QUINCENAL_5_20", cuotas: [{ id: "q", numeroCuota: 1, estado: "MORA" }] });
    expect(result[0]?.interesProgramado).toBe(50_000);
  });
  it("incrementa correctamente el plazo expresado en meses", () => {
    expect(incrementoPlazoMeses(3, "MENSUAL")).toBe(3);
    expect(incrementoPlazoMeses(3, "QUINCENAL_10_25")).toBe(1.5);
  });
});
'''

    checks = {
        "legacy blocker removed": "movimientos financieros" not in actions_source,
        "typed errors": "Promise<ExtensionTermState>" in actions_source,
        "transactional snapshot": "extensionPlazoSnapshot.create" in actions_source,
        "reversal validation": "financialImageMatches" in actions_source,
        "audit": "EXTENSION_PLAZO_APPLY" in actions_source and "EXTENSION_PLAZO_REVERSE" in actions_source,
        "paid preservation test": 'id: "paid"' in test_source,
    }
    failed = [label for label, passed in checks.items() if not passed]
    if failed:
        raise SystemExit("ERROR: consistency check failed: " + ", ".join(failed))

    atomic_write(SCHEMA, schema_next)
    atomic_write(QUERY, query_next)
    atomic_write(PAGE, page_next)
    atomic_write(ACTIONS, actions_source)
    atomic_write(STATE, state_source)
    atomic_write(POLICY, policy_source)
    atomic_write(FORM, form_source)
    atomic_write(TEST, test_source)
    atomic_write(MIGRATION, migration)

    print("OK: reversible Solo Interest term extension implemented")
    print("MIGRATION: additive, not applied")
    print("DATABASE: unchanged")
    for path in (SCHEMA, QUERY, PAGE, ACTIONS, STATE, POLICY, FORM, TEST, MIGRATION):
        print(f"MODIFIED_OR_CREATED: {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
