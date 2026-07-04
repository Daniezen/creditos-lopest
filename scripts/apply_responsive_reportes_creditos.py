#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.home() / "apps/lopest/web"

SIDEBAR = r'''"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Landmark, UserPlus } from "lucide-react";

import { dashboardNavigation } from "@/config/navigation";
import { LogoutButton } from "./logout-button";

export function DashboardSidebar() {
  const pathname = usePathname();
  const isReportsRoute = pathname.startsWith("/reportes");

  return (
    <aside
      className={[
        "hidden h-screen shrink-0 border-r border-violet-100 bg-white transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:flex-col",
        isReportsRoute ? "w-[92px]" : "w-[330px]",
      ].join(" ")}
    >
      <div className={["border-b border-violet-100", isReportsRoute ? "px-4 py-6" : "px-7 py-7"].join(" ")}>
        <Link href="/creditos" className={["flex items-center", isReportsRoute ? "justify-center" : "gap-4"].join(" ")} title="Créditos Lopest">
          <div className={["flex shrink-0 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100", isReportsRoute ? "h-14 w-14" : "h-16 w-16"].join(" ")}>
            <Landmark className={isReportsRoute ? "h-7 w-7" : "h-8 w-8"} />
          </div>
          {!isReportsRoute ? (
            <div>
              <p className="text-2xl font-black tracking-tight text-violet-950">Créditos</p>
              <p className="text-xl font-medium tracking-tight text-violet-700">Lopest</p>
            </div>
          ) : null}
        </Link>
      </div>

      {!isReportsRoute ? (
        <section className="border-b border-violet-100 px-5 py-5">
          <p className="mb-3 px-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Crear</p>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/creditos/nuevo" label="Crédito" icon={CreditCard} active={pathname.startsWith("/creditos/nuevo")} />
            <QuickAction href="/clientes/nuevo" label="Cliente" icon={UserPlus} active={pathname.startsWith("/clientes/nuevo")} />
          </div>
        </section>
      ) : null}

      <nav className={["min-h-0 flex-1 overflow-y-auto py-6", isReportsRoute ? "px-3" : "px-5"].join(" ")}>
        {!isReportsRoute ? (
          <p className="mb-4 px-3 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Navegación</p>
        ) : null}
        <div className="space-y-2">
          {dashboardNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={[
                  "group flex items-center rounded-2xl text-sm font-semibold transition",
                  isReportsRoute ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                  isActive ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-100" : "text-violet-950 hover:bg-violet-50 hover:text-violet-700",
                ].join(" ")}
              >
                <Icon className={["h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-violet-700"].join(" ")} />
                {!isReportsRoute ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {!isReportsRoute ? (
        <div className="border-t border-violet-100 px-5 py-5"><LogoutButton /></div>
      ) : null}
    </aside>
  );
}

interface QuickActionProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}

function QuickAction({ href, label, icon: Icon, active }: QuickActionProps) {
  return (
    <Link
      href={href}
      className={[
        "flex min-h-20 flex-col justify-between rounded-2xl border p-3 text-sm font-semibold transition",
        active ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-100" : "border-violet-100 bg-violet-50/70 text-violet-950 hover:border-violet-200 hover:bg-violet-100",
      ].join(" ")}
    >
      <Icon className={["h-5 w-5", active ? "text-white" : "text-violet-700"].join(" ")} />
      <span>{label}</span>
    </Link>
  );
}
'''

CREDITOS_LIST = r'''import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
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
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <PortfolioMetric label="Saldo vigente" value={formatCurrencyCOP(saldoTotal)} strong />
            <PortfolioMetric label="Créditos activos" value={String(creditosActivos.length)} />
            <PortfolioMetric label="Próxima cuota" value={proximaCuota ? formatCurrencyCOP(proximaCuota.valorProgramado) : "-"} helper={proximaCuota ? formatDateCO(proximaCuota.fechaProgramada) : undefined} />
          </div>
          <Link href="/creditos/nuevo" className="inline-flex w-fit items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700">
            <Plus className="h-4 w-4" /> Nuevo crédito
          </Link>
        </div>
      </section>

      <section className="mb-5 rounded-[1.75rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 backdrop-blur">
        <form action="/creditos" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
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
                    <tr key={credito.id} className="transition hover:bg-violet-50/45">
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
  return (
    <article className="p-3 transition hover:bg-violet-50/40 sm:p-4">
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
'''

for rel, content in {
    "src/components/dashboard/sidebar.tsx": SIDEBAR,
    "src/features/creditos/components/creditos-list.tsx": CREDITOS_LIST,
}.items():
    path = ROOT / rel
    backup = path.with_suffix(path.suffix + ".bak.responsive")
    if not backup.exists():
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(content, encoding="utf-8")
    print(f"OK: {rel}")

print("OK: responsive aplicado")
