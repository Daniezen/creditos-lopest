import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Contact,
  FileText,
  Home,
  Phone,
  UserRound,
} from "lucide-react";

import { obtenerClienteDetalle } from "@/features/clientes/queries";
import { formatCurrencyCOP, formatDateCO } from "@/lib/formatters";

interface ClienteDetallePageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClienteDetallePage({
  params,
}: ClienteDetallePageProps) {
  const { id } = await params;
  const cliente = await obtenerClienteDetalle(id);

  if (!cliente) {
    notFound();
  }

  const perfilIncompleto =
    !cliente.telefono ||
    !cliente.direccion ||
    !cliente.empresa ||
    !cliente.contacto ||
    cliente.estadoDocumentos === "FALTAN_DOCUMENTOS";

  const creditosActivos = cliente.creditos.filter(
    (credito) => credito.estado === "ACTIVO",
  );

  const saldoTotal = creditosActivos.reduce((total, credito) => {
    const ultimoEventoConSaldo = [...credito.eventos]
      .reverse()
      .find((evento) => evento.saldoCapitalPost !== null);

    return (
      total +
      (ultimoEventoConSaldo?.saldoCapitalPost
        ? Number(ultimoEventoConSaldo.saldoCapitalPost)
        : Number(credito.monto))
    );
  }, 0);

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 overflow-hidden rounded-[2rem] border border-violet-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_38%,#fff7ed_100%)] shadow-[0_18px_45px_rgba(109,40,217,0.10)]">
        <div className="flex flex-col justify-between gap-5 px-6 py-6 sm:px-7 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/80 text-violet-700 shadow-sm shadow-violet-100 ring-1 ring-violet-100">
              <UserRound className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
                Cliente
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {cliente.nombre}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                C.C. {cliente.cedula}
              </p>
            </div>
          </div>

          <Link
            href="/clientes"
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white/85 px-5 py-3 text-sm font-bold text-violet-700 shadow-sm shadow-violet-100/50 transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a clientes
          </Link>
        </div>
      </header>

      {perfilIncompleto ? (
        <section className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-semibold">Perfil pendiente de completar</h3>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Completa teléfono, dirección, empresa, contacto y documentos
                cuando esté disponible la edición de clientes.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Créditos activos" value={String(creditosActivos.length)} />
        <MetricCard label="Saldo cartera" value={formatCurrencyCOP(saldoTotal)} />
        <MetricCard
          label="Documentos"
          value={
            cliente.estadoDocumentos === "DOCUMENTOS_CARGADOS"
              ? "Cargados"
              : "Pendientes"
          }
        />
        <MetricCard label="Créditos total" value={String(cliente.creditos.length)} />
      </section>

      <section className="mb-6 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
        <h3 className="text-xl font-bold tracking-tight text-slate-950">
          Información del cliente
        </h3>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <InfoItem icon={Phone} label="Teléfono" value={cliente.telefono || "-"} />
          <InfoItem icon={Home} label="Dirección" value={cliente.direccion || "-"} />
          <InfoItem icon={Building2} label="Empresa" value={cliente.empresa || "-"} />
          <InfoItem icon={Contact} label="Contacto" value={cliente.contacto || "-"} />
          <InfoItem icon={Contact} label="Contacto 2" value={cliente.contacto2 || "-"} />
          <InfoItem icon={UserRound} label="Recomienda" value={cliente.recomienda || "-"} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <EstadoDocumentosBadge estado={cliente.estadoDocumentos} />

          {cliente.carpetaAdjuntosUrl ? (
            <a
              href={cliente.carpetaAdjuntosUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver carpeta
            </a>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="border-b border-violet-100 bg-gradient-to-r from-white to-violet-50/70 p-5">
          <h3 className="text-xl font-bold tracking-tight text-slate-950">
            Créditos del cliente
          </h3>
        </div>

        {cliente.creditos.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Este cliente aún no tiene créditos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-violet-50/45 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {cliente.creditos.map((credito) => {
                  const ultimoEventoConSaldo = [...credito.eventos]
                    .reverse()
                    .find((evento) => evento.saldoCapitalPost !== null);

                  const saldo = ultimoEventoConSaldo?.saldoCapitalPost
                    ? Number(ultimoEventoConSaldo.saldoCapitalPost)
                    : Number(credito.monto);

                  return (
                    <tr
                      key={credito.id}
                      className="transition hover:bg-violet-50/45"
                    >
                      <TableCell>
                        <Link
                          href={`/creditos/${credito.id}`}
                          className="font-black text-violet-700 hover:text-fuchsia-700 hover:underline"
                        >
                          {credito.codigo}
                        </Link>
                      </TableCell>

                      <TableCell className="text-right font-semibold text-slate-950">
                        {formatCurrencyCOP(Number(credito.monto))}
                      </TableCell>

                      <TableCell className="text-right font-bold text-slate-950">
                        {formatCurrencyCOP(saldo)}
                      </TableCell>

                      <TableCell>{formatDateCO(credito.fechaPrestamo)}</TableCell>

                      <TableCell>
                        {credito.estado === "ACTIVO" ? "Activo" : "Cancelado"}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/creditos/${credito.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
                        >
                          Ver
                        </Link>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white/85 p-4 shadow-sm shadow-violet-100/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

interface InfoItemProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function InfoItem({ icon: Icon, label, value }: InfoItemProps) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-[#fbfaff] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-violet-600" />
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
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
        Documentos cargados
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Faltan documentos
    </span>
  );
}
