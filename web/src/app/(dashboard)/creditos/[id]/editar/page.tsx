import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
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
      <header className={surfaceRecipes.pageHeaderBand}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-selection-strong)]">
            <CreditCard className="h-6 w-6" />
          </div>

          <div>
            <p className={dataDisplayRecipes.eyebrow}>
              Editar crédito
            </p>

            <h2 className="mt-1 text-2xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
              {credito.codigo}
            </h2>
          </div>
        </div>

        <Link
          href={`/creditos/${credito.id}`}
          className={actionRecipes.secondary}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al crédito
        </Link>
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
