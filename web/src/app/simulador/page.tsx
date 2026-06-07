"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
         * Fecha fija de referencia para que la simulación visual no dependa
         * de efectos colaterales escondidos. Más adelante puede exponerse como
         * selector si el negocio quiere proyectar mora contra una fecha específica.
         */
        fechaReferencia: new Date(),
      });

      const resumen = resumirCronograma(cronograma);

      return {
        cronograma,
        resumen,
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950/95 p-6 lg:block">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
              Créditos Lopest
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Plataforma
            </h1>
          </div>

          <nav className="space-y-2">
            <SidebarItem href="/simulador" active>
              Simulador de créditos
            </SidebarItem>

            <SidebarItem href="#" disabled>
              Créditos
            </SidebarItem>

            <SidebarItem href="#" disabled>
              Clientes
            </SidebarItem>

            <SidebarItem href="#" disabled>
              Documentos
            </SidebarItem>

            <SidebarItem href="#" disabled>
              Data Studio
            </SidebarItem>
          </nav>

          <div className="mt-10 rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-violet-100">
            <p className="font-semibold">Prioridad actual</p>
            <p className="mt-2 text-violet-100/80">
              Motor financiero puro, simulador visual y luego persistencia de
              créditos.
            </p>
          </div>
        </aside>

        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 xl:flex-row xl:items-end">
            <div>
              <p className="text-sm font-medium text-violet-300">
                Simulador financiero
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                Simular crédito
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Calcula cronogramas sin guardar datos en la base. Esta vista usa
                el motor financiero TypeScript puro y no depende de Prisma ni de
                n8n.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
              <span className="text-slate-500">Estado:</span>{" "}
              <span className="font-semibold text-emerald-300">
                simulación local
              </span>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-white">
                  Condiciones del crédito
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Los campos replican la lógica heredada de Google Sheets, pero
                  el cálculo ya está aislado en el dominio.
                </p>
              </div>

              <div className="space-y-4">
                <Field label="Fecha del préstamo">
                  <input
                    type="date"
                    value={form.fechaPrestamo}
                    onChange={(event) =>
                      updateField("fechaPrestamo", event.target.value)
                    }
                    className="input-base"
                  />
                </Field>

                <Field label="Valor del préstamo">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.monto}
                    onChange={(event) =>
                      updateField("monto", event.target.value)
                    }
                    className="input-base"
                    placeholder="Ej: 300000"
                  />
                </Field>

                <Field label="Plazo en meses">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.plazoMeses}
                    onChange={(event) =>
                      updateField("plazoMeses", event.target.value)
                    }
                    className="input-base"
                    placeholder="Ej: 3"
                  />
                </Field>

                <Field label="Tasa mensual">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.tasaMensual}
                    onChange={(event) =>
                      updateField("tasaMensual", event.target.value)
                    }
                    className="input-base"
                    placeholder="Ej: 20%, 20, 0.2 o 0,2"
                  />
                </Field>

                <Field label="Frecuencia">
                  <select
                    value={form.frecuencia}
                    onChange={(event) =>
                      updateField(
                        "frecuencia",
                        event.target.value as FrecuenciaPago,
                      )
                    }
                    className="input-base"
                  >
                    {FRECUENCIAS.map((frecuencia) => (
                      <option key={frecuencia} value={frecuencia}>
                        {frecuencia}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de crédito">
                  <select
                    value={form.tipoAmortizacion}
                    onChange={(event) =>
                      updateField(
                        "tipoAmortizacion",
                        event.target.value as TipoAmortizacion,
                      )
                    }
                    className="input-base"
                  >
                    {TIPOS_AMORTIZACION.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <h4 className="text-sm font-semibold text-slate-200">
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
                <div className="rounded-3xl border border-red-500/30 bg-red-950/40 p-5 text-red-100">
                  <h3 className="font-semibold">No se pudo simular</h3>
                  <p className="mt-2 text-sm text-red-100/80">
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

              <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Cronograma simulado
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      La tabla representa cuotas proyectadas. No refleja pagos
                      reales ni abonos.
                    </p>
                  </div>

                  <div className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
                    {resultado.cronograma.length} cuota(s)
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
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

                    <tbody className="divide-y divide-slate-800">
                      {resultado.cronograma.map((cuota) => (
                        <tr
                          key={cuota.numeroCuota}
                          className="hover:bg-slate-800/40"
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
                          <TableCell className="text-right font-semibold text-slate-100">
                            {formatCurrencyCOP(cuota.valorCuota)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrencyCOP(cuota.saldoCapitalPost)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                cuota.estado === "Atrasado"
                                  ? "rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-200"
                                  : "rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-200"
                              }
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
        </section>
      </div>
    </main>
  );
}

interface SidebarItemProps {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function SidebarItem({ href, active, disabled, children }: SidebarItemProps) {
  const className = [
    "block rounded-2xl px-4 py-3 text-sm font-medium transition",
    active
      ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
      : "text-slate-400 hover:bg-slate-900 hover:text-white",
    disabled ? "cursor-not-allowed opacity-50 hover:bg-transparent" : "",
  ].join(" ");

  if (disabled) {
    return (
      <span aria-disabled="true" className={className}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}

interface MetricLabelProps {
  label: string;
  children: React.ReactNode;
}

function MetricLabel({ label, children }: MetricLabelProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-100">{children}</dd>
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
        "rounded-3xl border p-5",
        featured
          ? "border-violet-400/40 bg-violet-500/15"
          : "border-slate-800 bg-slate-900/80",
      ].join(" ")}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </p>
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className}`}>{children}</td>;
}

interface TableHeadProps {
  className?: string;
  children: React.ReactNode;
}

function TableHead({ className = "", children }: TableHeadProps) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-left font-semibold ${className}`}>
      {children}
    </th>
  );
}