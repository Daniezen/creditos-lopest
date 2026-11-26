"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Trash2 } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import type {
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";
import type { SimulatorFormState } from "@/features/simulador-creditos/types";

import { actualizarCredito, eliminarCredito } from "./actions";

interface CreditEditFormProps {
  creditoId: string;
  /** `credito.actualizadoEn.toISOString()` as loaded (optimistic lock). */
  version: string;
  canEditFinancial: boolean;
  initialForm: SimulatorFormState;
  nota: string;
}

const FRECUENCIAS: FrecuenciaPago[] = [
  "Mensual",
  "Quincenal 15/30",
  "Quincenal 5/20",
  "Quincenal 10/25",
];

const TIPOS: TipoAmortizacion[] = ["Amortización Fija", "Solo Interés"];

export function CreditEditForm({
  creditoId,
  version,
  canEditFinancial,
  initialForm,
  nota,
}: CreditEditFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [note, setNote] = useState(nota);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveCanEditFinancial = canEditFinancial;

  function updateField<K extends keyof SimulatorFormState>(
    field: K,
    value: SimulatorFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSave() {
    setError(null);

    startTransition(async () => {
      const result = await actualizarCredito({
        id: creditoId,
        form,
        nota: note,
        version,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/creditos/${creditoId}`);
      router.refresh();
    });
  }

  function handleDelete() {
    const motivo = window.prompt(
      "Motivo del borrado. El crédito se ocultará, pero su historial se conservará:",
    )?.trim();

    if (!motivo) {
      return;
    }

    const confirmed = window.confirm(
      "¿Borrar este crédito? Desaparecerá de la cartera y los reportes, pero conservará su trazabilidad.",
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await eliminarCredito({
        id: creditoId,
        motivo,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push("/creditos");
      router.refresh();
    });
  }

  return (
    <section className={surfaceRecipes.card}>
      {!canEditFinancial ? (
        <div className={`mb-5 ${surfaceRecipes.alertWarning}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este crédito ya tiene actividad financiera. Para proteger el
            historial y el saldo, solo se pueden editar notas y observaciones.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input
          label="Fecha préstamo"
          type="date"
          value={form.fechaPrestamo}
          disabled={!effectiveCanEditFinancial}
          onChange={(value) => updateField("fechaPrestamo", value)}
        />

        <Input
          label="Monto"
          value={form.monto}
          disabled={!effectiveCanEditFinancial}
          onChange={(value) => updateField("monto", value)}
        />

        <Input
          label="Plazo en meses"
          value={form.plazoMeses}
          disabled={!effectiveCanEditFinancial}
          onChange={(value) => updateField("plazoMeses", value)}
        />

        <Input
          label="Tasa mensual"
          value={form.tasaMensual}
          disabled={!effectiveCanEditFinancial}
          onChange={(value) => updateField("tasaMensual", value)}
        />

        <Select
          label="Frecuencia"
          value={form.frecuencia}
          disabled={!effectiveCanEditFinancial}
          options={FRECUENCIAS}
          onChange={(value) => updateField("frecuencia", value as FrecuenciaPago)}
        />

        <Select
          label="Tipo de crédito"
          value={form.tipoAmortizacion}
          disabled={!effectiveCanEditFinancial}
          options={TIPOS}
          onChange={(value) =>
            updateField("tipoAmortizacion", value as TipoAmortizacion)
          }
        />
      </div>

      <div className="mt-5">
        <TextArea
          label="Nota"
          value={note}
          onChange={setNote}
        />
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
          Borrar crédito
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
  type?: "text" | "date";
  disabled?: boolean;
  onChange: (value: string) => void;
}

function Input({ label, value, type = "text", disabled, onChange }: InputProps) {
  return (
    <label className="block">
      <span className={formRecipes.label}>
        {label}
      </span>

      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={formRecipes.controlSpacious}
      />
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

function Select({ label, value, options, disabled, onChange }: SelectProps) {
  return (
    <label className="block">
      <span className={formRecipes.label}>
        {label}
      </span>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={formRecipes.controlSpacious}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function TextArea({ label, value, onChange }: TextAreaProps) {
  return (
    <label className="block">
      <span className={formRecipes.label}>
        {label}
      </span>

      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className={formRecipes.textarea}
      />
    </label>
  );
}

