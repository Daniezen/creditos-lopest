import {
  Building2,
  CheckCircle2,
  Contact,
  FileText,
  FolderOpen,
  Home,
  Phone,
  UserRound,
  Users,
} from "lucide-react";

import type { ClienteSelectorOption } from "@/features/clientes/types";

interface SelectedClientCardProps {
  cliente: ClienteSelectorOption | null;
}

/**
 * Tarjeta única de cliente seleccionado.
 */
export function SelectedClientCard({ cliente }: SelectedClientCardProps) {
  if (!cliente) {
    return (
      <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
          <UserRound className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-lg font-semibold text-slate-950">
          Cliente pendiente
        </h3>

        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Busca y selecciona un cliente existente, o crea un cliente rápido para
          continuar con el crédito.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-200 pb-4 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
            <UserRound className="h-6 w-6" />
          </div>

          <div>
            <p className="text-sm font-semibold text-violet-700">
              Cliente seleccionado
            </p>

            <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              {cliente.nombre}
            </h3>

            <p className="mt-1 text-sm text-slate-600">C.C. {cliente.cedula}</p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Seleccionado
        </span>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <ClientField icon={Phone} label="Teléfono" value={cliente.telefono} />
        <ClientField icon={Home} label="Dirección" value={cliente.direccion} />
        <ClientField icon={Building2} label="Empresa" value={cliente.empresa} />
        <ClientField icon={Users} label="Recomienda" value={cliente.recomienda} />
        <ClientField icon={Contact} label="Contacto" value={cliente.contacto} />
        <ClientField icon={Contact} label="Contacto 2" value={cliente.contacto2} />
        <ClientField
          icon={FileText}
          label="Estado documentos"
          value={formatEstadoDocumentos(cliente.estadoDocumentos)}
        />

        <div>
          <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-violet-400">
            <FolderOpen className="h-3.5 w-3.5" />
            Adjuntos
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {cliente.carpetaAdjuntosUrl ? (
              <a
                href={cliente.carpetaAdjuntosUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-violet-700 underline-offset-4 hover:underline"
              >
                <FolderOpen className="h-4 w-4" />
                Ver carpeta
              </a>
            ) : (
              "-"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface ClientFieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}

function ClientField({ icon: Icon, label, value }: ClientFieldProps) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-violet-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-900">{value || "-"}</dd>
    </div>
  );
}

function formatEstadoDocumentos(value: string): string {
  if (value === "DOCUMENTOS_CARGADOS") {
    return "Documentos cargados";
  }

  if (value === "FALTAN_DOCUMENTOS") {
    return "Faltan documentos";
  }

  return value;
}