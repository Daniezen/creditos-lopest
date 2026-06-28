"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRound } from "lucide-react";

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
        <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
          <Search className="h-4 w-4 text-violet-600" />
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
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />
      </label>

      {open ? (
        <div
          onScroll={handleScroll}
          className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
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
                    className="w-full px-4 py-3 text-left transition hover:bg-violet-50"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {item.clienteNombre}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
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
            <div className="px-4 py-5 text-sm text-slate-500">
              No hay resultados para esa búsqueda.
            </div>
          )}

          {visibleCount < filteredItems.length ? (
            <div className="border-t border-slate-100 px-4 py-3 text-center text-xs font-medium text-slate-400">
              Desplázate para ver más resultados
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
