"use client";

import { useState } from "react";

import type { ClienteSelectorOption } from "@/features/clientes/types";

import { ClientAutocomplete } from "./client-autocomplete";
import { QuickCreateClientModal } from "./quick-create-client-modal";
import { SelectedClientCard } from "./selected-client-card";

interface ClientStepProps {
  clientes: ClienteSelectorOption[];
  selectedCliente: ClienteSelectorOption | null;
  onSelectCliente: (cliente: ClienteSelectorOption) => void;
  onClienteCreado: (cliente: ClienteSelectorOption) => void;
}

/**
 * Paso 1 del wizard.
 *
 * UX final:
 * - Buscador con autocompletado.
 * - Modal de cliente rápido.
 * - Tarjeta única con todos los datos del cliente seleccionado.
 */
export function ClientStep({
  clientes,
  selectedCliente,
  onSelectCliente,
  onClienteCreado,
}: ClientStepProps) {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  function handleClienteCreado(cliente: ClienteSelectorOption) {
    onClienteCreado(cliente);
    onSelectCliente(cliente);
  }

  return (
    <>
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                Seleccionar cliente
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Busca por cédula, nombre, teléfono, empresa o contacto. El
                crédito real no podrá guardarse sin cliente seleccionado.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setQuickCreateOpen(true)}
              className="w-fit rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              Crear cliente rápido
            </button>
          </div>

          <div className="mt-5">
            <ClientAutocomplete
              clientes={clientes}
              selectedCliente={selectedCliente}
              onSelectCliente={onSelectCliente}
            />
          </div>
        </div>

        <SelectedClientCard cliente={selectedCliente} />
      </section>

      <QuickCreateClientModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onClienteCreado={handleClienteCreado}
      />
    </>
  );
}