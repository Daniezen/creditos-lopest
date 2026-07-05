"use client";

import type { ComponentType, KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Plus,
  Search,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

import { formatCurrencyCOP } from "@/lib/formatters";

import type { ClienteListadoItem } from "../queries";

interface ClientesListProps {
  clientes: ClienteListadoItem[];
  query: string;
  estadoDocumentos: string;
}

export function ClientesList({
  clientes,
  query,
  estadoDocumentos,
}: ClientesListProps) {
  const router = useRouter();

  function openCliente(id: string) {
    router.push(`/clientes/${id}`);
  }

  function handleClienteKeyDown(
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCliente(id);
    }
  }
  const perfilesPendientes = clientes.filter(
    (cliente) => cliente.perfilIncompleto,
  );

  const documentosPendientes = clientes.filter(
    (cliente) => cliente.estadoDocumentos === "FALTAN_DOCUMENTOS",
  );

  const creditosActivos = clientes.reduce(
    (total, cliente) => total + cliente.creditosActivos,
    0,
  );

  const saldoTotal = clientes.reduce(
    (total, cliente) => total + cliente.saldoTotal,
    0,
  );

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className="mb-5 rounded-[2rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 backdrop-blur">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <PortfolioMetric
              icon={Users}
              label="Clientes"
              value={String(clientes.length)}
            />

            <PortfolioMetric
              icon={AlertTriangle}
              label="Perfiles pendientes"
              value={String(perfilesPendientes.length)}
            />

            <PortfolioMetric
              icon={FileText}
              label="Documentos pendientes"
              value={String(documentosPendientes.length)}
            />

            <PortfolioMetric
              icon={WalletCards}
              label="Saldo cartera"
              value={formatCurrencyCOP(saldoTotal)}
              helper={`${creditosActivos} crédito(s) activo(s)`}
            />
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/clientes/nuevo"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Link>

            <Link
              href="/creditos/nuevo"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-2xl border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
            >
              <CreditCard className="h-4 w-4" />
              Crear crédito
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-[1.75rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 backdrop-blur">
        <form
          action="/clientes"
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_auto]"
        >
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Search className="h-4 w-4 text-violet-600" />
              Buscar cliente
            </span>

            <input
              name="q"
              defaultValue={query}
              placeholder="Nombre, cédula, teléfono, empresa o contacto"
              className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Documentos
            </span>

            <select
              name="estadoDocumentos"
              defaultValue={estadoDocumentos}
              className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-2.5 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
            >
              <option value="">Todos</option>
              <option value="FALTAN_DOCUMENTOS">Faltan documentos</option>
              <option value="DOCUMENTOS_CARGADOS">Documentos cargados</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700"
            >
              Buscar
            </button>

            <Link
              href="/clientes"
              className="rounded-2xl border border-violet-100 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Clientes
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {clientes.length} registro(s)
            </p>
          </div>
        </div>

        {clientes.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-950">
              No hay clientes para los filtros seleccionados.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ajusta la búsqueda o crea un nuevo cliente.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-violet-100 2xl:hidden">
              {clientes.map((cliente) => (
                <ClienteCompactCard key={cliente.id} cliente={cliente} />
              ))}
            </div>

            <div className="hidden overflow-x-auto 2xl:block">
              <table className="min-w-[1080px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-violet-50/45 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Créditos activos</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {clientes.map((cliente) => (
                    <tr
                      key={cliente.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openCliente(cliente.id)}
                      onKeyDown={(event) => handleClienteKeyDown(event, cliente.id)}
                      className="cursor-pointer transition hover:bg-violet-50/45"
                    >
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                            <UserRound className="h-4 w-4" />
                          </div>

                          <div>
                            <Link
                              href={`/clientes/${cliente.id}`}
                              className="font-black text-violet-700 hover:text-fuchsia-700 hover:underline"
                            >
                              {cliente.nombre}
                            </Link>

                            {cliente.perfilIncompleto ? (
                              <p className="mt-1 text-xs font-medium text-amber-700">
                                Perfil pendiente
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{cliente.cedula}</TableCell>
                      <TableCell>{cliente.telefono || "-"}</TableCell>
                      <TableCell>{cliente.empresa || "-"}</TableCell>
                      <TableCell>{cliente.creditosActivos}</TableCell>

                      <TableCell className="text-right font-bold text-slate-950">
                        {formatCurrencyCOP(cliente.saldoTotal)}
                      </TableCell>

                      <TableCell>
                        <EstadoDocumentosBadge estado={cliente.estadoDocumentos} />
                      </TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Link>
                      </TableCell>
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

function ClienteCompactCard({ cliente }: { cliente: ClienteListadoItem }) {
  const router = useRouter();

  function openCliente(id: string) {
    router.push(`/clientes/${id}`);
  }

  function handleClienteKeyDown(
    event: KeyboardEvent<HTMLElement>,
    id: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCliente(id);
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => openCliente(cliente.id)}
      onKeyDown={(event) => handleClienteKeyDown(event, cliente.id)}
      className="cursor-pointer p-3 transition hover:bg-violet-50/40 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/clientes/${cliente.id}`}
                className="block truncate font-black text-violet-700 hover:underline"
              >
                {cliente.nombre}
              </Link>
              <p className="text-xs text-slate-500">C.C. {cliente.cedula}</p>
              {cliente.perfilIncompleto ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  Perfil pendiente
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <Link
          href={`/clientes/${cliente.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
        >
          <Eye className="h-3.5 w-3.5" />
          Ver
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <CompactDatum label="Teléfono" value={cliente.telefono || "-"} />
        <CompactDatum label="Empresa" value={cliente.empresa || "-"} />
        <CompactDatum label="Créditos" value={String(cliente.creditosActivos)} />
        <CompactDatum label="Saldo" value={formatCurrencyCOP(cliente.saldoTotal)} />
      </div>

      <div className="mt-2">
        <EstadoDocumentosBadge estado={cliente.estadoDocumentos} />
      </div>
    </article>
  );
}

function CompactDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white/80 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate font-black text-slate-950">{value}</p>
    </div>
  );
}

interface PortfolioMetricProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper?: string;
}

function PortfolioMetric({ icon: Icon, label, value, helper }: PortfolioMetricProps) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white/85 p-4 shadow-sm shadow-violet-100/40">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-violet-600" />
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

interface TableCellProps {
  className?: string;
  children: ReactNode;
}

function TableCell({ className = "", children }: TableCellProps) {
  return (
    <td className={`whitespace-nowrap px-5 py-3.5 text-slate-700 ${className}`}>
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
      className={`whitespace-nowrap px-5 py-3 text-left font-black ${className}`}
    >
      {children}
    </th>
  );
}

function EstadoDocumentosBadge({ estado }: { estado: string }) {
  if (estado === "DOCUMENTOS_CARGADOS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Cargados
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Pendientes
    </span>
  );
}
