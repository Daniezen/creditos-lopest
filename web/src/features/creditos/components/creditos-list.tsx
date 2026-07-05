"use client";

import type { ComponentType, KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, Eye, Plus, ShieldCheck, WalletCards } from "lucide-react";

import { formatCurrencyCOP, formatDateCO, formatPercent } from "@/lib/formatters";

import { CreditSearchCombobox } from "./credit-search-combobox";
import type { CreditoListadoItem } from "../queries";

interface CreditosListProps {
  creditos: CreditoListadoItem[];
  query: string;
  estado: string;
}

export function CreditosList({ creditos, query, estado }: CreditosListProps) {
  const router = useRouter();

  function openCredito(id: string) {
    router.push(`/creditos/${id}`);
  }

  function handleCreditoKeyDown(
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCredito(id);
    }
  }
  const creditosActivos = creditos.filter((credito) => credito.estado === "ACTIVO");
  const saldoTotal = creditos.reduce((total, credito) => total + credito.saldoCapital, 0);
  const montoTotal = creditos.reduce((total, credito) => total + credito.monto, 0);
  const proximaCuota = creditos
    .map((credito) => credito.proximaCuota)
    .filter((cuota): cuota is NonNullable<typeof cuota> => cuota !== null)
    .sort((a, b) => a.fechaProgramada.getTime() - b.fechaProgramada.getTime())[0];

  const searchItems = creditos.map((credito) => ({
    id: credito.id,
    codigo: credito.codigo,
    clienteNombre: credito.cliente.nombre,
    clienteCedula: credito.cliente.cedula,
    clienteTelefono: credito.cliente.telefono,
    estado: credito.estado,
  }));

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className="mb-5 rounded-[2rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 backdrop-blur">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <PortfolioMetric label="Saldo vigente" value={formatCurrencyCOP(saldoTotal)} strong />
            <PortfolioMetric label="Créditos activos" value={String(creditosActivos.length)} />
            <PortfolioMetric label="Próxima cuota" value={proximaCuota ? formatCurrencyCOP(proximaCuota.valorProgramado) : "-"} helper={proximaCuota ? formatDateCO(proximaCuota.fechaProgramada) : undefined} />
          </div>
          <Link href="/creditos/nuevo" className="inline-flex w-fit shrink-0 items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700">
            <Plus className="h-4 w-4" /> Nuevo crédito
          </Link>
        </div>
      </section>

      <section className="mb-5 rounded-[1.75rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 backdrop-blur">
        <form action="/creditos" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <CreditSearchCombobox name="q" initialValue={query} items={searchItems} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Estado</span>
            <select name="estado" defaultValue={estado} className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15">
              <option value="">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700">Buscar</button>
            <Link href="/creditos" className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900">Limpiar</Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">Créditos</h3>
            <p className="mt-1 text-sm text-slate-500">{creditos.length} registro(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SmallPill icon={CreditCard} label={`${creditos.length} créditos`} />
            <SmallPill icon={ShieldCheck} label={`${creditosActivos.length} activos`} />
            <SmallPill icon={WalletCards} label={formatCurrencyCOP(montoTotal)} />
          </div>
        </div>

        {creditos.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-950">No hay créditos para los filtros seleccionados.</p>
            <p className="mt-2 text-sm text-slate-500">Ajusta la búsqueda o crea un nuevo crédito.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-violet-100 2xl:hidden">
              {creditos.map((credito) => <CreditoCompactCard key={credito.id} credito={credito} />)}
            </div>
            <div className="hidden overflow-x-auto 2xl:block">
              <table className="min-w-[1040px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-violet-50/45 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <TableHead>Código</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Próxima cuota</TableHead><TableHead className="text-right">Tasa</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acción</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditos.map((credito) => (
                    <tr
                      key={credito.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openCredito(credito.id)}
                      onKeyDown={(event) => handleCreditoKeyDown(event, credito.id)}
                      className="cursor-pointer transition hover:bg-violet-50/45"
                    >
                      <TableCell><Link href={`/creditos/${credito.id}`} className="font-bold text-violet-700 hover:underline">{credito.codigo}</Link></TableCell>
                      <TableCell><div><p className="font-semibold text-slate-950">{credito.cliente.nombre}</p><p className="mt-1 text-xs text-slate-500">C.C. {credito.cliente.cedula}</p></div></TableCell>
                      <TableCell className="text-right font-semibold text-slate-950">{formatCurrencyCOP(credito.monto)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-950">{formatCurrencyCOP(credito.saldoCapital)}</TableCell>
                      <TableCell>{credito.proximaCuota ? <div><p className="font-semibold text-slate-950">{formatCurrencyCOP(credito.proximaCuota.valorProgramado)}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{formatDateCO(credito.proximaCuota.fechaProgramada)}</p></div> : "-"}</TableCell>
                      <TableCell className="text-right">{formatPercent(credito.tasaMensual)}</TableCell>
                      <TableCell><EstadoCreditoBadge estado={credito.estado} /></TableCell>
                      <TableCell className="text-right"><Link href={`/creditos/${credito.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"><Eye className="h-3.5 w-3.5" />Ver</Link></TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function CreditoCompactCard({ credito }: { credito: CreditoListadoItem }) {
  const router = useRouter();

  function openCredito(id: string) {
    router.push(`/creditos/${id}`);
  }

  function handleCreditoKeyDown(
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCredito(id);
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => openCredito(credito.id)}
      onKeyDown={(event) => handleCreditoKeyDown(event, credito.id)}
      className="cursor-pointer p-3 transition hover:bg-violet-50/40 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/creditos/${credito.id}`} className="font-black text-violet-700 hover:underline">{credito.codigo}</Link>
            <EstadoCreditoBadge estado={credito.estado} />
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-950">{credito.cliente.nombre}</p>
          <p className="text-xs text-slate-500">C.C. {credito.cliente.cedula}</p>
        </div>
        <Link href={`/creditos/${credito.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"><Eye className="h-3.5 w-3.5" />Ver</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <CompactDatum label="Monto" value={formatCurrencyCOP(credito.monto)} />
        <CompactDatum label="Saldo" value={formatCurrencyCOP(credito.saldoCapital)} />
        <CompactDatum label="Tasa" value={formatPercent(credito.tasaMensual)} />
        <CompactDatoProximaCuota credito={credito} />
      </div>
    </article>
  );
}

function CompactDatoProximaCuota({ credito }: { credito: CreditoListadoItem }) {
  if (!credito.proximaCuota) return <CompactDatum label="Próxima" value="-" />;
  return <div className="rounded-2xl border border-violet-100 bg-white/80 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Próxima</p><p className="mt-1 truncate font-black text-slate-950">{formatCurrencyCOP(credito.proximaCuota.valorProgramado)}</p><p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays className="h-3 w-3" />{formatDateCO(credito.proximaCuota.fechaProgramada)}</p></div>;
}

function CompactDatum({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-violet-100 bg-white/80 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate font-black text-slate-950">{value}</p></div>;
}

interface PortfolioMetricProps { label: string; value: string; helper?: string; strong?: boolean; }
function PortfolioMetric({ label, value, helper, strong }: PortfolioMetricProps) { return <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm shadow-violet-100/40 backdrop-blur"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={["mt-2 tracking-tight", strong ? "text-3xl font-bold text-slate-950" : "text-xl font-bold text-slate-950"].join(" ")}>{value}</p>{helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}</div>; }

interface SmallPillProps { icon: ComponentType<{ className?: string }>; label: string; }
function SmallPill({ icon: Icon, label }: SmallPillProps) { return <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm"><Icon className="h-3.5 w-3.5 text-violet-600" />{label}</span>; }

interface TableCellProps { className?: string; children: ReactNode; }
function TableCell({ className = "", children }: TableCellProps) { return <td className={`whitespace-nowrap px-5 py-3.5 text-slate-700 ${className}`}>{children}</td>; }

interface TableHeadProps { className?: string; children: ReactNode; }
function TableHead({ className = "", children }: TableHeadProps) { return <th className={`whitespace-nowrap px-5 py-3 text-left font-black ${className}`}>{children}</th>; }

function EstadoCreditoBadge({ estado }: { estado: string }) {
  if (estado === "ACTIVO") return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Activo</span>;
  if (estado === "CANCELADO") return <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Cancelado</span>;
  return <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{estado}</span>;
}
