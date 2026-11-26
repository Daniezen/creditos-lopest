"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Phone, UserRound } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { crearClienteMinimo } from "@/features/clientes/actions";
import type { ClienteSelectorOption } from "@/features/clientes/types";

interface QuickCreateClientModalProps {
  open: boolean;
  onClose: () => void;
  onClienteCreado: (cliente: ClienteSelectorOption) => void;
}

/**
 * Modal de cliente rápido.
 *
 * No reemplaza la ficha completa de cliente.
 * Solo captura lo mínimo para continuar con el crédito.
 */
export function QuickCreateClientModal({
  open,
  onClose,
  onClienteCreado,
}: QuickCreateClientModalProps) {
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  if (!open) {
    return null;
  }

  function resetLocalState() {
    setCedula("");
    setNombre("");
    setTelefono("");
    setError(null);
  }

  function handleClose() {
    resetLocalState();
    onClose();
  }

  function handleCrearCliente() {
    setError(null);

    const cleanCedula = cedula.trim();
    const cleanNombre = nombre.trim();

    if (!cleanCedula || !cleanNombre) {
      setError("Cédula y nombre son obligatorios.");
      return;
    }

    startTransition(async () => {
      const result = await crearClienteMinimo({
        cedula: cleanCedula,
        nombre: cleanNombre,
        telefono: telefono.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onClienteCreado(result.cliente);
      resetLocalState();
      onClose();
    });
  }

  return (
    <div className={surfaceRecipes.modalBackdrop}>
      <section className={surfaceRecipes.modalDialog}>
        <header className={surfaceRecipes.modalHeader}>
          <h3 className="text-base font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
            Crear cliente rápido
          </h3>

          <p className="mt-1 text-xs font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
            Registra solo los datos necesarios para continuar.
          </p>
        </header>

        <div className={surfaceRecipes.alertWarning}>
          <div className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              La información completa del cliente deberá completarse después en
              el módulo Clientes.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3.5">
          <ModalInput
            icon={UserRound}
            label="Cédula"
            value={cedula}
            placeholder="Ej: 1000000000"
            onChange={setCedula}
          />

          <ModalInput
            icon={UserRound}
            label="Nombre"
            value={nombre}
            placeholder="Nombre del cliente"
            onChange={setNombre}
          />

          <ModalInput
            icon={Phone}
            label="Teléfono opcional"
            value={telefono}
            placeholder="Opcional"
            onChange={setTelefono}
          />
        </div>

        {error ? (
          <div className={surfaceRecipes.alertDanger}>
            {error}
          </div>
        ) : null}

        <footer className={surfaceRecipes.modalFooter}>
          <button
            type="button"
            onClick={handleClose}
            className={actionRecipes.secondary}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCrearCliente}
            disabled={isPending}
            className={actionRecipes.primary}
          >
            {isPending ? "Creando..." : "Crear y seleccionar"}
          </button>
        </footer>
      </section>
    </div>
  );
}

interface ModalInputProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function ModalInput({
  icon: Icon,
  label,
  value,
  placeholder,
  onChange,
}: ModalInputProps) {
  return (
    <label className="block">
      <span className={formRecipes.labelWithIcon}>
        <Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)] shrink-0" />
        <span>{label}</span>
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={formRecipes.control}
      />
    </label>
  );
}