"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  CreditCard,
  Hash,
  Percent,
  Repeat,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";

import type {
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";

import {
  formatCurrencyCOP,
  formatNumberCO,
  formatPercent,
  parseNumericInput,
  parseTasaMensualInput,
} from "@/lib/formatters";

import type { SimulatorFormState } from "../types";

const FRECUENCIAS: FrecuenciaPago[] = [
  "Mensual",
  "Quincenal 15/30",
  "Quincenal 5/20",
  "Quincenal 10/25",
];

const TIPOS_AMORTIZACION: TipoAmortizacion[] = [
  "Amortización Fija",
  "Solo Interés",
];

interface SimulatorFormProps {
  form: SimulatorFormState;
  onChange: <K extends keyof SimulatorFormState>(
    field: K,
    value: SimulatorFormState[K],
  ) => void;
  variant?: "panel" | "grid";
}

/**
 * Formulario financiero del simulador.
 *
 * No calcula cuotas. Solo captura valores y muestra entrada normalizada.
 */
export function SimulatorForm({
  form,
  onChange,
  variant = "panel",
}: SimulatorFormProps) {
  const isGrid = variant === "grid";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
          <SlidersHorizontal className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Condiciones del crédito
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Completa las condiciones financieras para generar el cronograma.
          </p>
        </div>
      </div>

      <div
        className={[
          "grid gap-4",
          isGrid ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1",
        ].join(" ")}
      >
        <Field icon={CalendarDays} label="Fecha del préstamo">
          <Input
            type="date"
            value={form.fechaPrestamo}
            onChange={(value) => onChange("fechaPrestamo", value)}
          />
        </Field>

        <Field icon={WalletCards} label="Valor del préstamo">
          <Input
            inputMode="decimal"
            value={form.monto}
            placeholder="Ej: 300.000"
            onChange={(value) => onChange("monto", value)}
          />
        </Field>

        <Field icon={Hash} label="Plazo en meses">
          <Input
            inputMode="decimal"
            value={form.plazoMeses}
            placeholder="Ej: 3"
            onChange={(value) => onChange("plazoMeses", value)}
          />
        </Field>

        <Field icon={Percent} label="Tasa mensual">
          <Input
            inputMode="decimal"
            value={form.tasaMensual}
            placeholder="Ej: 20%"
            onChange={(value) => onChange("tasaMensual", value)}
          />
        </Field>

        <Field icon={Repeat} label="Frecuencia">
          <Select
            value={form.frecuencia}
            placeholder="Selecciona frecuencia"
            onChange={(value) =>
              onChange("frecuencia", value as FrecuenciaPago | "")
            }
            options={FRECUENCIAS}
          />
        </Field>

        <Field icon={CreditCard} label="Tipo de crédito">
          <Select
            value={form.tipoAmortizacion}
            placeholder="Selecciona tipo"
            onChange={(value) =>
              onChange("tipoAmortizacion", value as TipoAmortizacion | "")
            }
            options={TIPOS_AMORTIZACION}
          />
        </Field>
      </div>

      <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-violet-950">
          <SlidersHorizontal className="h-4 w-4" />
          Entrada normalizada
        </h4>

        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <MetricLabel icon={WalletCards} label="Monto">
            {form.monto.trim()
              ? formatCurrencyCOP(parseNumericInput(form.monto))
              : "-"}
          </MetricLabel>

          <MetricLabel icon={Percent} label="Tasa">
            {form.tasaMensual.trim()
              ? formatPercent(parseTasaMensualInput(form.tasaMensual))
              : "-"}
          </MetricLabel>

          <MetricLabel icon={Hash} label="Plazo">
            {form.plazoMeses.trim()
              ? `${formatNumberCO(parseNumericInput(form.plazoMeses))} meses`
              : "-"}
          </MetricLabel>

          <MetricLabel icon={Repeat} label="Frecuencia">
            {form.frecuencia || "-"}
          </MetricLabel>
        </dl>
      </div>
    </section>
  );
}

interface FieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}

function Field({ icon: Icon, label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
        <Icon className="h-4 w-4 text-violet-600" />
        {label}
      </span>
      {children}
    </label>
  );
}

interface InputProps {
  type?: "text" | "date";
  value: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}

function Input({
  type = "text",
  value,
  placeholder,
  inputMode,
  onChange,
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
    />
  );
}

interface SelectProps {
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
}

function Select({ value, placeholder, options, onChange }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
    >
      <option value="" disabled>
        {placeholder}
      </option>

      {options.map((option) => (
        <option key={option} value={option} className="bg-white text-slate-950">
          {option}
        </option>
      ))}
    </select>
  );
}

interface MetricLabelProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}

function MetricLabel({ icon: Icon, label, children }: MetricLabelProps) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-violet-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-900">{children}</dd>
    </div>
  );
}