"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Trash2 } from "lucide-react";

import { actualizarCredito, eliminarCredito } from "./actions";

import type {
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";
import type { SimulatorFormState } from "@/features/simulador-creditos/types";

interface CreditEditFormProps {
  creditoId: string;
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
    const confirmed = window.confirm(
      "¿Eliminar este crédito? Solo se permitirá si no tiene pagos, abonos ni historial financiero real.",
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await eliminarCredito({
        id: creditoId,
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
    <section className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      {!canEditFinancial ? (
        <div className="mb-5 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Este crédito ya tiene actividad financiera. Para proteger el
              historial y el saldo, solo se pueden editar notas y observaciones.
            </p>
          </div>




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
          Eliminar crédito
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
  type?: "text" | "date";
  disabled?: boolean;
  onChange: (value: string) => void;
}

function Input({ label, value, type = "text", disabled, onChange }: InputProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
      />
    </label>
  );
}
