"use client";

import { useMemo, useState, type ReactNode } from "react";

import { generarCronogramaSimulado } from "@/domain/creditos/simulador/calcular-cronograma";
import { resumirCronograma } from "@/domain/creditos/simulador/resumen-cronograma";

import type {
  FrecuenciaPago,
  TipoAmortizacion,
} from "@/domain/creditos/simulador/tipos";

import {
  formatCurrencyCOP,
  formatDateCO,
  formatNumberCO,
  formatPercent,
  parseDateInputValue,
  parseNumericInput,
  parseTasaMensualInput,
  toDateInputValue,
} from "@/lib/formatters";

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

interface FormState {
  fechaPrestamo: string;
  monto: string;
  plazoMeses: string;
  tasaMensual: string;
  frecuencia: FrecuenciaPago;
  tipoAmortizacion: TipoAmortizacion;
}

const initialFormState: FormState = {
  fechaPrestamo: toDateInputValue(new Date()),
  monto: "300000",
  plazoMeses: "3",
  tasaMensual: "20%",
  frecuencia: "Quincenal 15/30",
  tipoAmortizacion: "Amortización Fija",
};

export default function SimuladorPage() {
  const [form, setForm] = useState<FormState>(initialFormState);

  const resultado = useMemo(() => {
    try {
      const fechaPrestamo = parseDateInputValue(form.fechaPrestamo);
      const monto = parseNumericInput(form.monto);
      const plazoMeses = parseNumericInput(form.plazoMeses);
      const tasaMensual = parseTasaMensualInput(form.tasaMensual);

      const cronograma = generarCronogramaSimulado({
        fechaPrestamo,
        monto,
        plazoMeses,
        tasaMensual,
        frecuencia: form.frecuencia,
        tipoAmortizacion: form.tipoAmortizacion,

        /**
         * La fecha de referencia queda explícita.
         * Esto evita lógica oculta dentro del motor financiero.
         */
        fechaReferencia: new Date(),
      });

      return {
        cronograma,
        resumen: resumirCronograma(cronograma),
        error: null,
      };
    } catch (error) {
      return {
        cronograma: [],
        resumen: null,
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido al calcular la simulación.",
      };
    }
  }, [form]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialFormState);
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Simulador financiero
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Simular crédito
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Genera cronogramas proyectados sin persistir datos. Esta pantalla
            usa el motor financiero puro migrado desde Apps Script y validado
            con pruebas automatizadas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
          >
            Limpiar simulación
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            title="Pendiente: requiere flujo transaccional con Prisma"
          >
            Guardar como crédito próximamente
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-950">
              Condiciones del crédito
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Ingresa los valores base. La tasa acepta formatos como{" "}
              <span className="font-medium text-slate-800">20%</span>,{" "}
              <span className="font-medium text-slate-800">20</span>,{" "}
              <span className="font-medium text-slate-800">0.2</span> o{" "}
              <span className="font-medium text-slate-800">0,2</span>.
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Fecha del préstamo">
              <Input
                type="date"
                value={form.fechaPrestamo}
                onChange={(value) => updateField("fechaPrestamo", value)}
              />
            </Field>

            <Field label="Valor del préstamo">
              <Input
                inputMode="decimal"
                value={form.monto}
                placeholder="Ej: 300000"
                onChange={(value) => updateField("monto", value)}
              />
            </Field>

            <Field label="Plazo en meses">
              <Input
                inputMode="decimal"
                value={form.plazoMeses}
                placeholder="Ej: 3"
                onChange={(value) => updateField("plazoMeses", value)}
              />
            </Field>

            <Field label="Tasa mensual">
              <Input
                inputMode="decimal"
                value={form.tasaMensual}
                placeholder="Ej: 20%"
                onChange={(value) => updateField("tasaMensual", value)}
              />
            </Field>

            <Field label="Frecuencia">
              <Select
                value={form.frecuencia}
                onChange={(value) =>
                  updateField("frecuencia", value as FrecuenciaPago)
                }
                options={FRECUENCIAS}
              />
            </Field>

            <Field label="Tipo de crédito">
              <Select
                value={form.tipoAmortizacion}
                onChange={(value) =>
                  updateField("tipoAmortizacion", value as TipoAmortizacion)
                }
                options={TIPOS_AMORTIZACION}
              />
            </Field>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-800">
              Entrada normalizada
            </h4>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <MetricLabel label="Monto">
                {formatCurrencyCOP(parseNumericInput(form.monto))}
              </MetricLabel>

              <MetricLabel label="Tasa">
                {formatPercent(parseTasaMensualInput(form.tasaMensual))}
              </MetricLabel>

              <MetricLabel label="Plazo">
                {formatNumberCO(parseNumericInput(form.plazoMeses))} meses
              </MetricLabel>

              <MetricLabel label="Frecuencia">
                {form.frecuencia}
              </MetricLabel>
            </dl>
          </div>
        </section>

        <section className="space-y-6">
          {resultado.error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-900">
              <h3 className="font-semibold">No se pudo simular</h3>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {resultado.error}
              </p>
            </div>
          ) : null}

          {resultado.resumen ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard
                label="Total capital"
                value={formatCurrencyCOP(resultado.resumen.totalCapital)}
              />

              <SummaryCard
                label="Total interés"
                value={formatCurrencyCOP(resultado.resumen.totalInteres)}
              />

              <SummaryCard
                label="Total a pagar"
                value={formatCurrencyCOP(resultado.resumen.totalPagar)}
                featured
              />

              <SummaryCard
                label="Número de cuotas"
                value={String(resultado.resumen.numeroCuotas)}
              />

              <SummaryCard
                label="Primera cuota"
                value={formatDateCO(resultado.resumen.fechaPrimeraCuota)}
              />

              <SummaryCard
                label="Última cuota"
                value={formatDateCO(resultado.resumen.fechaUltimaCuota)}
              />
            </section>
          ) : null}

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Cronograma simulado
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Esta tabla no representa pagos reales, abonos ni mora
                  persistida. Es una proyección financiera.
                </p>
              </div>

              <div className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                {resultado.cronograma.length} cuota(s)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <TableHead>N°</TableHead>
                    <TableHead>Fecha programada</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-right">Interés</TableHead>
                    <TableHead className="text-right">Valor cuota</TableHead>
                    <TableHead className="text-right">Saldo capital</TableHead>
                    <TableHead>Estado proyectado</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {resultado.cronograma.map((cuota) => (
                    <tr
                      key={cuota.numeroCuota}
                      className="transition hover:bg-slate-50"
                    >
                      <TableCell>{cuota.numeroCuota}</TableCell>

                      <TableCell>
                        {formatDateCO(cuota.fechaProgramada)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrencyCOP(cuota.capitalProgramado)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrencyCOP(cuota.interesProgramado)}
                      </TableCell>

                      <TableCell className="text-right font-semibold text-slate-950">
                        {formatCurrencyCOP(cuota.valorCuota)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatCurrencyCOP(cuota.saldoCapitalPost)}
                      </TableCell>

                      <TableCell>
                        <span
                          className={[
                            "rounded-full px-2 py-1 text-xs font-semibold",
                            cuota.estado === "Atrasado"
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700",
                          ].join(" ")}
                        >
                          {cuota.estado}
                        </span>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
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
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
    />
  );
}

interface SelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function Select({ value, options, onChange }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-white text-slate-950">
          {option}
        </option>
      ))}
    </select>
  );
}

interface MetricLabelProps {
  label: string;
  children: ReactNode;
}

function MetricLabel({ label, children }: MetricLabelProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  featured?: boolean;
}

function SummaryCard({ label, value, featured }: SummaryCardProps) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 shadow-sm",
        featured
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p
        className={[
          "mt-2 text-2xl font-bold tracking-tight",
          featured ? "text-emerald-900" : "text-slate-950",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return (
    <td className={`whitespace-nowrap px-4 py-3 text-slate-700 ${className}`}>
      {children}
    </td>
  );
}

interface TableHeadProps {
  className?: string;
  children: ReactNode;
}

function TableHead({ className = "", children }: TableHeadProps) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-left font-semibold ${className}`}
    >
      {children}
    </th>
  );
}