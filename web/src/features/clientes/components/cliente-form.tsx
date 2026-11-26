"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Trash2 } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";

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
    <section className={surfaceRecipes.card}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Cédula" value={form.cedula} onChange={(value) => updateField("cedula", value)} />
        <Input label="Nombre" value={form.nombre} onChange={(value) => updateField("nombre", value)} />
        <Input label="Teléfono" value={form.telefono} onChange={(value) => updateField("telefono", value)} />
        <Input label="Dirección" value={form.direccion} onChange={(value) => updateField("direccion", value)} />
        <Input label="Empresa" value={form.empresa} onChange={(value) => updateField("empresa", value)} />
        <Input label="Recomendado por" value={form.recomienda} onChange={(value) => updateField("recomienda", value)} />
        <Input label="Contacto" value={form.contacto} onChange={(value) => updateField("contacto", value)} />
        <Input label="Contacto 2" value={form.contacto2} onChange={(value) => updateField("contacto2", value)} />
        <Input
          label="Carpeta de adjuntos"
          value={form.carpetaAdjuntosUrl}
          onChange={(value) => updateField("carpetaAdjuntosUrl", value)}
        />

        <label className="block">
          <span className={formRecipes.label}>
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
            className={formRecipes.controlSpacious}
          >
            <option value="FALTAN_DOCUMENTOS">Faltan documentos</option>
            <option value="DOCUMENTOS_CARGADOS">Documentos cargados</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className={`mt-5 ${surfaceRecipes.alertDanger}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-5">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className={actionRecipes.destructive}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar cliente
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={actionRecipes.primaryLarge}
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
      <span className={formRecipes.label}>
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={formRecipes.controlSpacious}
      />
    </label>
  );
}
