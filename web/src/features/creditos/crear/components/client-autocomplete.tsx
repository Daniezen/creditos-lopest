"use client";

import { useMemo, useRef, useState } from "react";

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
    /**
     * Se usa pequeño delay para permitir click en una opción del dropdown
     * antes de cerrar la lista por pérdida de foco del input.
     */
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
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Buscar cliente
        </span>

        <input
          type="text"
          value={query}
          placeholder="Buscar por cédula, nombre, teléfono, empresa o contacto"
          onChange={(event) => handleChange(event.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />
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
                        /**
                         * Evita que el input pierda foco antes de ejecutar
                         * la selección del cliente.
                         */
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
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {cliente.nombre}
                        </p>

                        <p className="text-xs leading-5 text-slate-500">
                          C.C. {cliente.cedula}
                          {" · "}
                          Tel. {cliente.telefono || "-"}
                          {cliente.empresa ? ` · ${cliente.empresa}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-slate-500">
              No se encontraron clientes con ese criterio.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
