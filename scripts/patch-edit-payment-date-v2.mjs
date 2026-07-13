import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const actionsPath = join(root, "web/src/features/creditos/pagos/actions.ts");
const pagePath = join(root, "web/src/app/(dashboard)/creditos/[id]/page.tsx");
const componentPath = join(root, "web/src/features/creditos/pagos/components/edit-payment-date.tsx");
const statePath = join(root, "web/src/features/creditos/pagos/payment-date-state.ts");

for (const path of [actionsPath, pagePath]) {
  if (!existsSync(path)) throw new Error(`Falta archivo requerido: ${path}`);
}

const stateSource = `export interface UpdatePaymentDateState {
  ok: boolean;
  message: string | null;
}
`;

const componentSource = `"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilLine, X } from "lucide-react";

import { actualizarFechaPagoCuota } from "../actions";
import type { UpdatePaymentDateState } from "../payment-date-state";

interface EditPaymentDateProps {
  eventoId: string;
  creditoId: string;
  initialDate: string;
  formattedDate: string;
  compact?: boolean;
}

const initialState: UpdatePaymentDateState = { ok: false, message: null };

export function EditPaymentDate({
  eventoId,
  creditoId,
  initialDate,
  formattedDate,
  compact = false,
}: EditPaymentDateProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(actualizarFechaPagoCuota, initialState);

  useEffect(() => {
    if (state.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [router, state.ok]);

  if (!editing) {
    return (
      <div className={compact ? "rounded-2xl border border-violet-100 bg-white/80 px-3 py-2" : "flex items-center gap-2"}>
        {compact ? <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Fecha real</p> : null}
        <div className={compact ? "mt-1 flex items-center gap-2" : "flex items-center gap-2"}>
          <span className="font-semibold text-slate-900">{formattedDate}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-violet-100 bg-white text-violet-700 transition hover:bg-violet-50"
            aria-label="Editar fecha real de pago"
            title="Editar fecha real de pago"
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        </div>
        {state.message && !state.ok ? <p className="mt-1 text-xs font-semibold text-red-700">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className={compact ? "rounded-2xl border border-violet-200 bg-white p-2" : "min-w-[190px]"}>
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="creditoId" value={creditoId} />
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          name="fechaPago"
          defaultValue={initialDate}
          required
          disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-2 py-1.5 text-xs text-slate-950 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 disabled:opacity-60"
        />
        <button type="submit" disabled={pending} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700 disabled:bg-slate-300" aria-label="Guardar fecha real de pago" title="Guardar">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50" aria-label="Cancelar edición" title="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
      {pending ? <p className="mt-1 text-xs text-slate-500">Guardando...</p> : state.message && !state.ok ? <p className="mt-1 text-xs font-semibold text-red-700">{state.message}</p> : null}
    </form>
  );
}
`;

mkdirSync(dirname(componentPath), { recursive: true });
writeFileSync(componentPath, componentSource, "utf8");
writeFileSync(statePath, stateSource, "utf8");

let actions = readFileSync(actionsPath, "utf8");

if (!actions.includes('import { recordAuditLogTx } from "@/server/audit/audit-log";')) {
  const marker = 'import { assertCanMutate, requireCreditoAccess } from "@/server/auth/scope";';
  if (!actions.includes(marker)) throw new Error("No se encontro import de auth/scope en pagos/actions.ts");
  actions = actions.replace(marker, `${marker}\nimport { recordAuditLogTx } from "@/server/audit/audit-log";\n\nimport type { UpdatePaymentDateState } from "./payment-date-state";`);
}

const registrarStart = actions.indexOf("export async function registrarPagoCuota(");
const reversarStart = actions.indexOf("export async function reversarPagoCuota(");
if (registrarStart === -1 || reversarStart === -1) throw new Error("No se encontraron actions de registrar/reversar pago.");

let registrarBlock = actions.slice(registrarStart, reversarStart);
if (!registrarBlock.includes("fechaProgramada: true,")) {
  registrarBlock = registrarBlock.replace("        interesProgramado: true,", "        interesProgramado: true,\n        fechaProgramada: true,");
}
registrarBlock = registrarBlock.replace("        diasAtraso: 0,", "        diasAtraso: calcularDiasAtraso(evento.fechaProgramada, hoy),");
actions = actions.slice(0, registrarStart) + registrarBlock + actions.slice(reversarStart);

if (!actions.includes("export async function actualizarFechaPagoCuota(")) {
  const insertAt = actions.indexOf("export async function reversarPagoCuota(");
  const newAction = `export async function actualizarFechaPagoCuota(
  _previousState: UpdatePaymentDateState,
  formData: FormData,
): Promise<UpdatePaymentDateState> {
  try {
    const eventoId = leerCampoObligatorio(formData, "eventoId");
    const creditoId = leerCampoObligatorio(formData, "creditoId");
    const fechaPagoRaw = leerCampoObligatorio(formData, "fechaPago");
    const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(fechaPagoRaw);

    if (!match) throw new Error("La fecha real de pago no tiene un formato válido.");

    const fechaPago = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (fechaPago.getFullYear() !== Number(match[1]) || fechaPago.getMonth() !== Number(match[2]) - 1 || fechaPago.getDate() !== Number(match[3])) {
      throw new Error("La fecha real de pago no es válida.");
    }

    const hoy = obtenerHoyColombia();
    if (fechaPago.getTime() > hoy.getTime()) throw new Error("La fecha real de pago no puede estar en el futuro.");

    const { user } = await requireCreditoAccess(creditoId);
    assertCanMutate(user);

    await prisma.$transaction(async (tx) => {
      const evento = await tx.eventoFinanciero.findUnique({
        where: { id: eventoId },
        include: { credito: { select: { id: true, codigo: true, fechaPrestamo: true } } },
      });

      if (!evento || evento.creditoId !== creditoId) throw new Error("La cuota no existe o no pertenece al crédito indicado.");
      if (evento.tipo !== TipoEventoFinanciero.CUOTA_PROGRAMADA) throw new Error("Solo se puede editar la fecha real de una cuota programada.");
      if (evento.estado !== EstadoEventoFinanciero.PAGADO || !evento.fechaPago) throw new Error("Solo se puede editar la fecha real de una cuota pagada.");
      if (fechaPago.getTime() < normalizarFechaSinHora(evento.credito.fechaPrestamo).getTime()) throw new Error("La fecha real de pago no puede ser anterior a la fecha del préstamo.");

      const diasAtraso = calcularDiasAtraso(evento.fechaProgramada, fechaPago);

      await tx.eventoFinanciero.update({ where: { id: evento.id }, data: { fechaPago, diasAtraso, accionPor: user.id } });
      await recordAuditLogTx(tx, {
        actorId: user.id,
        action: "CUOTA_UPDATE_PAYMENT_DATE",
        entityType: "EventoFinanciero",
        entityId: evento.id,
        before: { fechaPago: evento.fechaPago.toISOString(), diasAtraso: evento.diasAtraso },
        after: { fechaPago: fechaPago.toISOString(), diasAtraso },
        metadata: { creditoId: evento.credito.id, creditoCodigo: evento.credito.codigo, eventoCodigo: evento.codigo, numeroCuota: evento.numeroCuota },
      });
    });

    revalidatePath("/creditos");
    revalidatePath(\`/creditos/\${creditoId}\`);
    return { ok: true, message: "Fecha real de pago actualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar la fecha real de pago." };
  }
}

`;
  actions = actions.slice(0, insertAt) + newAction + actions.slice(insertAt);
}
writeFileSync(actionsPath, actions, "utf8");

let page = readFileSync(pagePath, "utf8");
if (!page.includes('import { EditPaymentDate } from "@/features/creditos/pagos/components/edit-payment-date";')) {
  const marker = 'import { obtenerCreditoDetalle } from "@/features/creditos/queries";';
  if (!page.includes(marker)) throw new Error("No se encontro import de obtenerCreditoDetalle.");
  page = page.replace(marker, `${marker}\nimport { EditPaymentDate } from "@/features/creditos/pagos/components/edit-payment-date";`);
}

const mobileOld = `<CompactField
                      label="Fecha real"
                      value={formatDateCO(evento.fechaPago)}
                    />`;
const mobileNew = `{estaPagado && evento.fechaPago ? (
                      <EditPaymentDate eventoId={evento.id} creditoId={credito.id} initialDate={evento.fechaPago.toISOString().slice(0, 10)} formattedDate={formatDateCO(evento.fechaPago)} compact />
                    ) : (
                      <CompactField label="Fecha real" value="-" />
                    )}`;
if (page.includes(mobileOld)) page = page.replace(mobileOld, mobileNew);

const desktopOld = `<TableCell>{formatDateCO(evento.fechaPago)}</TableCell>`;
const desktopNew = `<TableCell>
                      {estaPagado && evento.fechaPago ? (
                        <EditPaymentDate eventoId={evento.id} creditoId={credito.id} initialDate={evento.fechaPago.toISOString().slice(0, 10)} formattedDate={formatDateCO(evento.fechaPago)} />
                      ) : (
                        "-"
                      )}
                    </TableCell>`;
if (page.includes(desktopOld)) page = page.replace(desktopOld, desktopNew);

if (!page.includes("<EditPaymentDate")) throw new Error("No se pudo insertar EditPaymentDate en page.tsx.");
writeFileSync(pagePath, page, "utf8");

console.log("[OK] Componente autocontenido creado.");
console.log("[OK] Server action y auditoría agregadas.");
console.log("[OK] UI mobile/desktop actualizada.");
