"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Phone, Search, UserRound } from "lucide-react";

import type { ClienteSelectorOption } from "@/features/clientes/types";

interface ClientAutocompleteProps {
  clientes: ClienteSelectorOption[];
  selectedCliente: ClienteSelectorOption | null;
  onSelectCliente: (cliente: ClienteSelectorOption) => void;
}

/**
 * Buscador de cliente con autocompletado.
 *
 * No renderiza una lista larga de tarjetas.
 * Solo muestra un dropdown acotado debajo del input.
 */
export function ClientAutocomplete({
  clientes,
  selectedCliente,
  onSelectCliente,
}: ClientAutocompleteProps) {
  const [query, setQuery] = useState(
    selectedCliente ? `${selectedCliente.cedula} - ${selectedCliente.nombre}` : "",
  );
  const [isOpen, setIsOpen] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resultados = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
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
      .slice(0, 8);
  }, [clientes, query]);

  function handleFocus() {
    if (query.trim()) {
      setIsOpen(true);
    }
  }

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }

  function handleSelect(cliente: ClienteSelectorOption) {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    onSelectCliente(cliente);
    setQuery(`${cliente.cedula} - ${cliente.nombre}`);
    setIsOpen(false);
  }

  function handleChange(value: string) {
    setQuery(value);
    setIsOpen(value.trim().length > 0);
  }

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Search className="h-4 w-4 text-violet-600" />
          Buscar cliente
        </span>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            value={query}
            placeholder="Buscar por cédula, nombre, teléfono, empresa o contacto"
            onChange={(event) => handleChange(event.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full rounded-2xl border border-slate-300 bg-white px-11 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
      </label>

      {isOpen ? (
        <div className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {resultados.length > 0 ? (
            <ul className="py-2">
              {resultados.map((cliente) => {
                const isSelected = selectedCliente?.id === cliente.id;

                return (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSelect(cliente);
                      }}
                      className={[
                        "w-full px-4 py-3 text-left transition",
                        isSelected
                          ? "bg-violet-50"
                          : "hover:bg-violet-50/70",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {cliente.nombre}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-slate-500">
                            <span>C.C. {cliente.cedula}</span>

                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {cliente.telefono || "-"}
                            </span>

                            {cliente.empresa ? (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {cliente.empresa}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-slate-500">
              <Search className="h-4 w-4 text-slate-400" />
              No se encontraron clientes con ese criterio.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}