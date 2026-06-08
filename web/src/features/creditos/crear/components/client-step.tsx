"use client";

import { useMemo, useState } from "react";

import type { ClienteSelectorOption } from "@/features/clientes/types";

import { QuickCreateClientModal } from "./quick-create-client-modal";

interface ClientStepProps {
  clientes: ClienteSelectorOption[];
  selectedCliente: ClienteSelectorOption | null;
  onSelectCliente: (cliente: ClienteSelectorOption) => void;
  onClienteCreado: (cliente: ClienteSelectorOption) => void;
}

/**
 * Paso 1 del wizard.
 *
 * Responsabilidad:
 * - Buscar cliente existente.
 * - Seleccionar cliente.
 * - Abrir modal de cliente rápido si no existe.
 *
 * No debe:
 * - Crear cliente completo.
 * - Gestionar documentos.
 * - Editar dirección/empresa/contactos.
 */
export function ClientStep({
  clientes,
  selectedCliente,
  onSelectCliente,
  onClienteCreado,
}: ClientStepProps) {
  const [query, setQuery] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const clientesFiltrados = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return clientes.slice(0, 20);
    }

    return clientes
      .filter((cliente) => {
        const searchable = [
          cliente.nombre,
          cliente.cedula,
          cliente.telefono ?? "",
          cliente.empresa ?? "",
          cliente.direccion ?? "",
          cliente.recomienda ?? "",
          cliente.contacto ?? "",
          cliente.contacto2 ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .slice(0, 20);
  }, [clientes, query]);

  function handleClienteCreado(cliente: ClienteSelectorOption) {
    onClienteCreado(cliente);
    onSelectCliente(cliente);
    setQuery(`${cliente.cedula} ${cliente.nombre}`);
  }

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">
                Seleccionar cliente
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Busca por nombre, cédula, teléfono, empresa o contacto. El
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
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Buscar cliente
              </span>

              <input
                type="text"
                value={query}
                placeholder="Ej: cédula, nombre, teléfono o empresa"
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {clientesFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                No se encontraron clientes con ese criterio.
              </div>
            ) : null}

            {clientesFiltrados.map((cliente) => {
              const isSelected = selectedCliente?.id === cliente.id;

              return (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => onSelectCliente(cliente)}
                  className={[
                    "w-full rounded-2xl border p-4 text-left transition",
                    isSelected
                      ? "border-violet-300 bg-violet-50 ring-2 ring-violet-500/10"
                      : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {cliente.nombre}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        C.C. {cliente.cedula}
                      </p>
                    </div>

                    {isSelected ? (
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                        Seleccionado
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                    <p>Teléfono: {cliente.telefono || "-"}</p>
                    <p>Empresa: {cliente.empresa || "-"}</p>
                    <p>Dirección: {cliente.direccion || "-"}</p>
                    <p>Contacto: {cliente.contacto || "-"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm xl:sticky xl:top-6">
          <h3 className="text-lg font-semibold text-violet-950">
            Cliente seleccionado
          </h3>

          {selectedCliente ? (
            <div className="mt-4 space-y-3 text-sm leading-6 text-violet-900">
              <p>
                <span className="font-semibold">Nombre:</span>{" "}
                {selectedCliente.nombre}
              </p>
              <p>
                <span className="font-semibold">Cédula:</span>{" "}
                {selectedCliente.cedula}
              </p>
              <p>
                <span className="font-semibold">Teléfono:</span>{" "}
                {selectedCliente.telefono || "-"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-violet-800">
              Selecciona un cliente existente o crea un cliente rápido para
              continuar.
            </p>
          )}
        </aside>
      </section>

      <QuickCreateClientModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onClienteCreado={handleClienteCreado}
      />
    </>
  );
}