"use client";

import type { KeyboardEvent } from "react";
import { Search, X } from "lucide-react";

import { formRecipes } from "@/design-system/recipes/forms";

import styles from "./creditos-list.module.css";

interface CreditSearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

/** Filters the complete authorized Credit result through URL synchronization. */
export function CreditSearchFilter({ value, onChange }: CreditSearchFilterProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && value) {
      event.preventDefault();
      onChange("");
    }
  }

  return (
    <label className={styles.searchWrapper}>
      <span className={formRecipes.labelWithIcon}>
        <Search className="h-4 w-4 text-[var(--color-action-primary)]" />
        Buscar créditos
      </span>
      <span className={styles.searchControlWrapper}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          value={value}
          placeholder="Código, cliente, cédula o teléfono"
          autoComplete="off"
          className={formRecipes.searchControl}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {value ? (
          <button
            type="button"
            className={styles.clearSearch}
            onClick={() => onChange("")}
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </span>
    </label>
  );
}
