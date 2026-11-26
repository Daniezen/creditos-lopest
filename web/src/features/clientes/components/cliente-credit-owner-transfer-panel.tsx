import { ArrowRightLeft, CreditCard, UserRound } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { formatCurrencyCOP } from "@/lib/formatters";
import { transferirCreditoOwnerAction } from "@/features/creditos/admin-actions";

import type { UsuarioOperadorActivoItem } from "../admin-queries";

interface CreditoTransferItem {
  id: string;
  codigo: string;
  estado: string;
  monto: unknown;
  ownerUserId: string | null;
}

interface ClienteCreditOwnerTransferPanelProps {
  creditos: CreditoTransferItem[];
  operadores: UsuarioOperadorActivoItem[];
}

/**
 * Panel administrativo para transferir creditos individuales dentro del detalle
 * de un cliente.
 *
 * La UI vive en clientes porque compone la vista /clientes/[id].
 * La mutacion vive en creditos porque modifica Credito.ownerUserId.
 */
export function ClienteCreditOwnerTransferPanel({
  creditos,
  operadores,
}: ClienteCreditOwnerTransferPanelProps) {
  if (creditos.length === 0) {
    return null;
  }

  return (
    <section className={`mb-5 ${surfaceRecipes.card}`}>
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4 sm:flex-row sm:items-center">
        <div>
          <p className={`flex items-center gap-2 ${dataDisplayRecipes.eyebrow}`}>
            <ArrowRightLeft className="h-4 w-4" />
            Administración
          </p>
          <h3 className="mt-2 text-xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
            Transferencia individual de créditos
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Mueve créditos específicos a otra cuenta sin transferir el cliente
            completo. Esto permite que el cliente quede compartido entre
            propietarios con carteras separadas.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {creditos.map((credito) => {
          const ownerActual =
            operadores.find((operador) => operador.id === credito.ownerUserId) ??
            null;

          return (
            <article
              key={credito.id}
              className="grid gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-end"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
                  <CreditCard className="h-3.5 w-3.5 text-[var(--color-selection-strong)]" />
                  Crédito
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="font-[var(--font-weight-heading)] text-[var(--color-selection-strong)]">{credito.codigo}</p>
                  <p className="text-sm font-[var(--font-weight-data-emphasis)] text-[var(--color-text-primary)]">
                    {formatCurrencyCOP(Number(credito.monto))}
                  </p>
                  <span className={credito.estado === "ACTIVO" ? statusRecipes.vigente : statusRecipes.cancelado}>
                    {credito.estado === "ACTIVO" ? "Activo" : "Cancelado"}
                  </span>
                </div>

                <p className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <UserRound className="h-4 w-4 text-[var(--color-selection-strong)]" />
                  <span>
                    Propietario actual: {ownerActual?.nombre ?? "Sin propietario reconocido"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {ownerActual?.email ?? credito.ownerUserId ?? "ownerUserId vacío"}
                </p>
              </div>

              <form action={transferirCreditoOwnerAction} className="grid gap-3">
                <input type="hidden" name="creditoId" value={credito.id} />

                <label className="block">
                  <span className={formRecipes.label}>
                    Nuevo propietario del crédito
                  </span>
                  <select
                    name="targetOwnerUserId"
                    defaultValue=""
                    className={formRecipes.controlSpacious}
                  >
                    <option value="" disabled>
                      Selecciona usuario
                    </option>
                    {operadores.map((operador) => (
                      <option
                        key={operador.id}
                        value={operador.id}
                        disabled={operador.id === credito.ownerUserId}
                      >
                        {operador.nombre} - {operador.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={formRecipes.label}>
                    Motivo opcional
                  </span>
                  <input
                    name="reason"
                    placeholder="Ej: crédito asignado a cartera de Martha"
                    className={formRecipes.controlSpacious}
                  />
                </label>

                <button
                  type="submit"
                  className={actionRecipes.primaryLarge}
                >
                  Transferir crédito
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}
