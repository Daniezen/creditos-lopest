"use server";
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
