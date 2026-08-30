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

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { formRecipes } from "@/design-system/recipes/forms";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { statusRecipes } from "@/design-system/recipes/status";
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

  const clientesConCreditoActivo = clientes.filter(
    (cliente) => cliente.creditosActivos > 0,
  ).length;

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className={surfaceRecipes.sectionSpacious}>
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
              label="Clientes con crédito activo"
              value={String(clientesConCreditoActivo)}
              helper={`${creditosActivos} crédito(s) activo(s)`}
            />
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/clientes/nuevo"
              className={actionRecipes.primaryLarge}
            >
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Link>

            <Link
              href="/creditos/nuevo"
              className={actionRecipes.secondaryLarge}
            >
              <CreditCard className="h-4 w-4" />
              Crear crédito
            </Link>
          </div>
        </div>
      </section>

      <section className={surfaceRecipes.sectionCompact}>
        <form
          action="/clientes"
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px_auto]"
        >
          <label className="block">
            <span className={formRecipes.labelWithIcon}>
              <Search className="h-4 w-4 text-[var(--color-action-primary)]" />
              Buscar cliente
            </span>

            <input
              name="q"
              defaultValue={query}
              placeholder="Nombre, cédula, teléfono, empresa o contacto"
              className={formRecipes.control}
            />
          </label>

          <label className="block">
            <span className={formRecipes.label}>
              Documentos
            </span>

            <select
              name="estadoDocumentos"
              defaultValue={estadoDocumentos}
              className={formRecipes.control}
            >
              <option value="">Todos</option>
              <option value="FALTAN_DOCUMENTOS">Faltan documentos</option>
              <option value="DOCUMENTOS_CARGADOS">Documentos cargados</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className={actionRecipes.primary}
            >
              Buscar
            </button>

            <Link
              href="/clientes"
              className={actionRecipes.secondary}
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className={surfaceRecipes.dataPanel}>
        <div className={surfaceRecipes.dataPanelHeader}>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Clientes
            </h3>

            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {clientes.length} registro(s)
            </p>
          </div>
        </div>

        {clientes.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              No hay clientes para los filtros seleccionados.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ajusta la búsqueda o crea un nuevo cliente.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--color-border-subtle)] 2xl:hidden">
              {clientes.map((cliente) => (
                <ClienteCompactCard key={cliente.id} cliente={cliente} />
              ))}
            </div>

            <div className="hidden overflow-x-auto 2xl:block">
              <table className="min-w-[1080px] w-full divide-y divide-[var(--color-border-default)] text-sm">
                <thead className="bg-[var(--color-surface-subtle)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Créditos activos</TableHead>
                    <TableHead className="text-right">Capital pendiente</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {clientes.map((cliente) => (
                    <tr
                      key={cliente.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => openCliente(cliente.id)}
                      onKeyDown={(event) => handleClienteKeyDown(event, cliente.id)}
                      className={dataDisplayRecipes.operationalRow}
                    >
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <div className={dataDisplayRecipes.entityAvatar}>
                            <UserRound className="h-4 w-4" />
                          </div>

                          <div>
                            <Link
                              href={`/clientes/${cliente.id}`}
                              className={dataDisplayRecipes.entityLink}
                            >
                              {cliente.nombre}
                            </Link>

                            {cliente.perfilIncompleto ? (
                              <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">
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

                      <TableCell className="text-right font-semibold text-[var(--color-text-primary)] tabular-nums">
                        {formatCurrencyCOP(cliente.saldoTotal)}
                      </TableCell>

                      <TableCell>
                        <EstadoDocumentosBadge estado={cliente.estadoDocumentos} />
                      </TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className={actionRecipes.tertiaryPill}
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
      className={dataDisplayRecipes.compactRow}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className={dataDisplayRecipes.entityAvatar}>
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/clientes/${cliente.id}`}
                className={dataDisplayRecipes.compactEntityLink}
              >
                {cliente.nombre}
              </Link>
              <p className="text-xs text-[var(--color-text-secondary)]">C.C. {cliente.cedula}</p>
              {cliente.perfilIncompleto ? (
                <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">
                  Perfil pendiente
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <Link
          href={`/clientes/${cliente.id}`}
          className={actionRecipes.tertiaryPill}
        >
          <Eye className="h-3.5 w-3.5" />
          Ver
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <CompactDatum label="Teléfono" value={cliente.telefono || "-"} />
        <CompactDatum label="Empresa" value={cliente.empresa || "-"} />
        <CompactDatum label="Créditos" value={String(cliente.creditosActivos)} />
        <CompactDatum label="Capital pendiente" value={formatCurrencyCOP(cliente.saldoTotal)} />
      </div>

      <div className="mt-2">
        <EstadoDocumentosBadge estado={cliente.estadoDocumentos} />
      </div>
    </article>
  );
}

function CompactDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className={dataDisplayRecipes.compactDatum}>
      <p className={dataDisplayRecipes.compactDatumLabel}>
        {label}
      </p>
      <p className={dataDisplayRecipes.compactDatumValue}>{value}</p>
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
    <div className={dataDisplayRecipes.metric}>
      <p className={dataDisplayRecipes.metricLabel}>
        <Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)]" />
        {label}
      </p>
      <p className={dataDisplayRecipes.metricValue}>
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
    <td className={`${dataDisplayRecipes.tableCell} ${className}`}>
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
      className={`${dataDisplayRecipes.tableHead} ${className}`}
    >
      {children}
    </th>
  );
}

function EstadoDocumentosBadge({ estado }: { estado: string }) {
  if (estado === "DOCUMENTOS_CARGADOS") {
    return (
      <span className={statusRecipes.success}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Cargados
      </span>
    );
  }

  return (
    <span className={statusRecipes.warning}>
      <AlertTriangle className="h-3.5 w-3.5" />
      Pendientes
    </span>
  );
}
