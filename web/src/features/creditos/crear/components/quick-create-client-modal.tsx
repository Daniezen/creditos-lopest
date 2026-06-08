"use client";

import { useState, useTransition } from "react";

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
 * Este modal NO reemplaza /clientes/nuevo.
 * Solo evita bloquear el flujo de creación de crédito cuando el cliente no existe.
 *
 * Campos permitidos:
 * - cedula
 * - nombre
 * - telefono opcional
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

    startTransition(async () => {
      const result = await crearClienteMinimo({
        cedula,
        nombre,
        telefono,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-sm font-semibold text-violet-700">
            Cliente rápido
          </p>

          <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
            Crear cliente mínimo
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Captura únicamente lo necesario para continuar. La ficha completa se
            editará después desde el módulo Clientes.
          </p>
        </header>

        <div className="mt-5 space-y-4">
          <ModalInput
            label="Cédula"
            value={cedula}
            placeholder="Ej: 1000000000"
            onChange={setCedula}
          />

          <ModalInput
            label="Nombre"
            value={nombre}
            placeholder="Nombre del cliente"
            onChange={setNombre}
          />

          <ModalInput
            label="Teléfono opcional"
            value={telefono}
            placeholder="Opcional"
            onChange={setTelefono}
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <footer className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCrearCliente}
            disabled={isPending}
            className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Creando..." : "Crear y seleccionar"}
          </button>
        </footer>
      </section>
    </div>
  );
}

interface ModalInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

function ModalInput({ label, value, placeholder, onChange }: ModalInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />
    </label>
  );
}