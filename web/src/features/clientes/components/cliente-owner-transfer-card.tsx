import { ShieldCheck, UserRound } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { transferirClienteOwnerAction } from "../admin-actions";
import type { UsuarioOperadorActivoItem } from "../admin-queries";

interface ClienteOwnerTransferCardProps {
  clienteId: string;
  currentOwnerUserId: string | null;
  operadores: UsuarioOperadorActivoItem[];
}

/**
 * Tarjeta administrativa para transferir propietario operativo del cliente.
 *
 * Es un componente de servidor con form action. No usa estado cliente porque la
 * operacion debe validarse y auditarse completamente en servidor.
 */
export function ClienteOwnerTransferCard({
  clienteId,
  currentOwnerUserId,
  operadores,
}: ClienteOwnerTransferCardProps) {
  const ownerActual =
    operadores.find((operador) => operador.id === currentOwnerUserId) ?? null;

  return (
    <section className={`mb-5 ${surfaceRecipes.card}`}>
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4 sm:flex-row sm:items-center">
        <div>
          <p className={`flex items-center gap-2 ${dataDisplayRecipes.eyebrow}`}>
            <ShieldCheck className="h-4 w-4" />
            Administración
          </p>
          <h3 className="mt-2 text-xl font-[var(--font-weight-heading)] tracking-tight text-[var(--color-text-primary)]">
            Propietario del cliente
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Transfiere la visibilidad operativa del cliente. Sus créditos,
            cuotas y documentos permanecen asociados al mismo cliente.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className={surfaceRecipes.cardSubtle}>
          <p className="flex items-center gap-2 text-xs font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
            <UserRound className="h-3.5 w-3.5 text-[var(--color-selection-strong)]" />
            Propietario actual
          </p>
          <p className="mt-2 font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
            {ownerActual?.nombre ?? "Sin propietario reconocido"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {ownerActual?.email ?? currentOwnerUserId ?? "ownerUserId vacío"}
          </p>
        </div>

        <form action={transferirClienteOwnerAction} className="grid gap-3">
          <input type="hidden" name="clienteId" value={clienteId} />

          <label className="block">
            <span className={formRecipes.label}>
              Nuevo propietario
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
                  disabled={operador.id === currentOwnerUserId}
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
              placeholder="Ej: asignación a cartera de Martha"
              className={formRecipes.controlSpacious}
            />
          </label>

          <button
            type="submit"
            className={actionRecipes.primaryLarge}
          >
            Transferir cliente
          </button>
        </form>
      </div>
    </section>
  );
}
