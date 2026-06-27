"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";

import { crearClienteMinimo } from "../actions";

/**
 * Formulario dedicado para crear clientes.
 *
 * Motivo:
 * - no obligar a crear cliente desde el flujo de crédito;
 * - permitir alta rápida de clientes con datos completos;
 * - reutilizar la acción existente crearClienteMinimo, que ya valida cédula
 *   duplicada y normaliza campos opcionales.
 *
 * Restricción actual:
 * - no sube documentos;
 * - no crea carpeta Drive;
 * - eso debe quedar en un flujo documental separado.
 */
export function ClienteCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    cedula: "",
    nombre: "",
    direccion: "",
    empresa: "",
    telefono: "",
    recomienda: "",
    contacto: "",
    contacto2: "",
  });

  function updateField<K extends keyof typeof form>(
    field: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const result = await crearClienteMinimo(form);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/clientes/${result.cliente.id}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input
          label="Cédula"
          value={form.cedula}
          required
          onChange={(value) => updateField("cedula", value)}
        />

        <Input
          label="Nombre"
          value={form.nombre}
          required
          onChange={(value) => updateField("nombre", value)}
        />

        <Input
          label="Teléfono"
          value={form.telefono}
          onChange={(value) => updateField("telefono", value)}
        />

        <Input
          label="Dirección"
          value={form.direccion}
          onChange={(value) => updateField("direccion", value)}
        />

        <Input
          label="Empresa"
          value={form.empresa}
          onChange={(value) => updateField("empresa", value)}
        />

        <Input
          label="Recomienda"
          value={form.recomienda}
          onChange={(value) => updateField("recomienda", value)}
        />

        <Input
          label="Contacto"
          value={form.contacto}
          onChange={(value) => updateField("contacto", value)}
        />

        <Input
          label="Contacto 2"
          value={form.contacto2}
          onChange={(value) => updateField("contacto2", value)}
        />
      </div>

      {error ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex justify-end border-t border-violet-100 pt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Guardando..." : "Crear cliente"}
        </button>
      </div>
    </section>
  );
}

interface InputProps {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}

function Input({ label, value, required, onChange }: InputProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
      />
    </label>
  );
}
