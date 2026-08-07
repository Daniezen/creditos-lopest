"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRound } from "lucide-react";

import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";

export interface CreditSearchItem {
  id: string;
  codigo: string;
  clienteNombre: string;
  clienteCedula: string;
  clienteTelefono: string | null;
  estado: string;
}

interface CreditSearchComboboxProps {
  name: string;
  initialValue: string;
  items: CreditSearchItem[];
}

/**
 * Buscador dinámico local para la cartera.
 *
 * Comportamiento:
 * - abre resultados al hacer foco;
 * - filtra mientras se escribe;
 * - muestra resultados en bloques de 10;
 * - al hacer scroll carga 10 más;
 * - al seleccionar abre el crédito.
 *
 * Este enfoque es correcto para el volumen inicial limitado.
 * Si la cartera crece significativamente, se debe migrar a búsqueda server-side.
 */
export function CreditSearchCombobox({
  name,
  initialValue,
  items,
}: CreditSearchComboboxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const searchable = [
        item.codigo,
        item.clienteNombre,
        item.clienteCedula,
        item.clienteTelefono ?? "",
        item.estado,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [items, query]);

  const visibleItems = filteredItems.slice(0, visibleCount);

  function handleChange(value: string) {
    setQuery(value);
    setVisibleCount(10);
    setOpen(true);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  function handleSelect(id: string) {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    router.push(`/creditos/${id}`);
  }

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom < 48 && visibleCount < filteredItems.length) {
      setVisibleCount((current) => Math.min(current + 10, filteredItems.length));
    }
  }

  return (
    <div className="relative">
      <label className="block">
        <span className={formRecipes.labelWithIcon}>
          <Search className="h-4 w-4 text-[var(--color-action-primary)]" />
          Buscar cliente
        </span>

        <input
          name={name}
          value={query}
          placeholder="Código, cliente, cédula o teléfono"
          autoComplete="off"
          onChange={(event) => handleChange(event.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={formRecipes.control}
        />
      </label>

      {open ? (
        <div
          onScroll={handleScroll}
          className={formRecipes.comboboxPanel}
        >
          {visibleItems.length > 0 ? (
            <ul className="py-2">
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(item.id);
                    }}
                    className={formRecipes.comboboxOption}
                  >
                    <div className="flex gap-3">
                      <div className={dataDisplayRecipes.entityAvatar}>
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className={dataDisplayRecipes.suggestionTitle}>
                          {item.clienteNombre}
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {item.codigo} · C.C. {item.clienteCedula}
                          {item.clienteTelefono
                            ? ` · Tel. ${item.clienteTelefono}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-5 text-sm text-[var(--color-text-secondary)]">
              No hay resultados para esa búsqueda.
            </div>
          )}

          {visibleCount < filteredItems.length ? (
            <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 text-center text-xs font-[var(--font-weight-label)] text-[var(--color-text-muted)]">
              Desplázate para ver más resultados
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
