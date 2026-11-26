"use client";

import { useMemo, useRef, useState } from "react";
import { Building2, Phone, Search, UserRound } from "lucide-react";

import { formRecipes } from "@/design-system/recipes/forms";
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
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return clientes.slice(0, 8);
    }

    return clientes
      .filter((cliente) => {
        const matchNombre = cliente.nombre.toLowerCase().includes(cleanQuery);
        const matchCedula = cliente.cedula.toLowerCase().includes(cleanQuery);
        const matchTelefono = (cliente.telefono || "")
          .toLowerCase()
          .includes(cleanQuery);
        const matchEmpresa = (cliente.empresa || "")
          .toLowerCase()
          .includes(cleanQuery);
        const matchRecomendado = (cliente.recomienda || "")
          .toLowerCase()
          .includes(cleanQuery);

        return (
          matchNombre ||
          matchCedula ||
          matchTelefono ||
          matchEmpresa ||
          matchRecomendado
        );
      })
      .slice(0, 8);
  }, [clientes, query]);

  function handleSelect(cliente: ClienteSelectorOption) {
    setQuery(`${cliente.cedula} - ${cliente.nombre}`);
    setIsOpen(false);
    onSelectCliente(cliente);
  }

  function handleFocus() {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    setIsOpen(true);
  }

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }

  function handleChange(value: string) {
    setQuery(value);
    setIsOpen(value.trim().length > 0);
  }

  return (
    <div className="relative">
      <label className="block">
        <span className={formRecipes.labelWithIcon}>
          <Search className="h-4 w-4 text-[var(--color-action-primary)]" />
          Buscar cliente
        </span>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />

          <input
            type="text"
            value={query}
            placeholder="Buscar por cédula, nombre, teléfono, empresa o contacto"
            onChange={(event) => handleChange(event.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={formRecipes.searchControl}
          />
        </div>
      </label>

      {isOpen ? (
        <div className={formRecipes.comboboxPanel}>
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
                        formRecipes.comboboxOption,
                        isSelected ? formRecipes.comboboxOptionActive : "",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-selection)] text-[var(--color-selection-strong)]">
                          <UserRound className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-[var(--font-weight-data-emphasis)] text-[var(--color-text-primary)]">
                            {cliente.nombre}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-[var(--color-text-secondary)]">
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
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-[var(--color-text-secondary)]">
              <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
              No se encontraron clientes con ese criterio.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}