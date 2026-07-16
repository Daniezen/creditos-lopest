import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";

import { CreditEditForm } from "@/features/creditos/editar/credit-edit-form";
import { obtenerCreditoDetalle } from "@/features/creditos/queries";
import { toDateInputValue } from "@/lib/formatters";
import type { FrecuenciaPago, TipoAmortizacion } from "@/domain/creditos/simulador/tipos";

interface EditarCreditoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditarCreditoPage({
  params,
}: EditarCreditoPageProps) {
  const { id } = await params;
  const credito = await obtenerCreditoDetalle(id);

  if (!credito) {
    notFound();
  }

  const canEditFinancial = !credito.eventos.some((evento) => {
    return (
      evento.tipo === "ABONO_CAPITAL" ||
      evento.estado === "PAGADO" ||
      evento.estado === "CANCELADO_POR_ABONO" ||
      Number(evento.montoPagado) > 0 ||
      Number(evento.capitalPagado) > 0 ||
      Number(evento.interesPagado) > 0 ||
      evento.fechaPago !== null
    );
  });

  const initialForm = {
    fechaPrestamo: toDateInputValue(credito.fechaPrestamo),
    monto: String(Number(credito.monto)),
    plazoMeses: String(Number(credito.plazoMeses)),
    tasaMensual: String(Number(credito.tasaMensual)),
    frecuencia: mapFrecuenciaFromPrisma(credito.frecuencia),
    tipoAmortizacion: mapTipoFromPrisma(credito.tipoAmortizacion),
  };

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 overflow-hidden rounded-[2rem] border border-violet-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_38%,#fff7ed_100%)] shadow-[0_18px_45px_rgba(109,40,217,0.10)]">
        <div className="flex flex-col justify-between gap-5 px-6 py-6 sm:px-7 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/80 text-violet-700 shadow-sm shadow-violet-100 ring-1 ring-violet-100">
              <CreditCard className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
                Editar crédito
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {credito.codigo}
              </h2>
            </div>
          </div>

          <Link
            href={`/creditos/${credito.id}`}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white/85 px-5 py-3 text-sm font-bold text-violet-700 shadow-sm shadow-violet-100/50 transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al crédito
          </Link>
        </div>
      </header>

      <CreditEditForm
        creditoId={credito.id}
        canEditFinancial={canEditFinancial}
        initialForm={initialForm}
        nota={credito.nota ?? ""}
      />
    </main>
  );
}

function mapFrecuenciaFromPrisma(value: string): FrecuenciaPago {
  if (value === "MENSUAL") {
    return "Mensual";
  }

  if (value === "QUINCENAL_5_20") {
    return "Quincenal 5/20";
  }

  if (value === "QUINCENAL_10_25") {
    return "Quincenal 10/25";
  }

  return "Quincenal 15/30";
}

function mapTipoFromPrisma(value: string): TipoAmortizacion {
  if (value === "SOLO_INTERES") {
    return "Solo Interés";
  }

  return "Amortización Fija";
}
