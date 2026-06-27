"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Trash2 } from "lucide-react";

import { actualizarCliente, eliminarCliente } from "../actions";

interface ClienteFormProps {
  cliente: {
    id: string;
    cedula: string;
    nombre: string;
    direccion: string | null;
    empresa: string | null;
    telefono: string | null;
    recomienda: string | null;
    contacto: string | null;
    contacto2: string | null;
    carpetaAdjuntosUrl: string | null;
    estadoDocumentos: "FALTAN_DOCUMENTOS" | "DOCUMENTOS_CARGADOS";
  };
}

export function ClienteForm({ cliente }: ClienteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    cedula: cliente.cedula,
    nombre: cliente.nombre,
    direccion: cliente.direccion ?? "",
    empresa: cliente.empresa ?? "",
    telefono: cliente.telefono ?? "",
    recomienda: cliente.recomienda ?? "",
    contacto: cliente.contacto ?? "",
    contacto2: cliente.contacto2 ?? "",
    carpetaAdjuntosUrl: cliente.carpetaAdjuntosUrl ?? "",
    estadoDocumentos: cliente.estadoDocumentos,
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
      const result = await actualizarCliente({
        id: cliente.id,
        ...form,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/clientes/${cliente.id}`);
      router.refresh();
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      "¿Eliminar este cliente? Solo se permitirá si no tiene documentos ni actividad financiera real.",
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await eliminarCliente({
        id: cliente.id,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push("/clientes");
      router.refresh();
    });
  }

  return (
    <section className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Cédula" value={form.cedula} onChange={(value) => updateField("cedula", value)} />
        <Input label="Nombre" value={form.nombre} onChange={(value) => updateField("nombre", value)} />
        <Input label="Teléfono" value={form.telefono} onChange={(value) => updateField("telefono", value)} />
        <Input label="Dirección" value={form.direccion} onChange={(value) => updateField("direccion", value)} />
        <Input label="Empresa" value={form.empresa} onChange={(value) => updateField("empresa", value)} />
        <Input label="Recomienda" value={form.recomienda} onChange={(value) => updateField("recomienda", value)} />
        <Input label="Contacto" value={form.contacto} onChange={(value) => updateField("contacto", value)} />
        <Input label="Contacto 2" value={form.contacto2} onChange={(value) => updateField("contacto2", value)} />
        <Input
          label="Carpeta de adjuntos"
          value={form.carpetaAdjuntosUrl}
          onChange={(value) => updateField("carpetaAdjuntosUrl", value)}
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Estado documentos
          </span>

          <select
            value={form.estadoDocumentos}
            onChange={(event) =>
              updateField(
                "estadoDocumentos",
                event.target.value as "FALTAN_DOCUMENTOS" | "DOCUMENTOS_CARGADOS",
              )
            }
            className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
          >
            <option value="FALTAN_DOCUMENTOS">Faltan documentos</option>
            <option value="DOCUMENTOS_CARGADOS">Documentos cargados</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-violet-100 pt-5">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar cliente
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </section>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function Input({ label, value, onChange }: InputProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
      />
    </label>
  );
}
