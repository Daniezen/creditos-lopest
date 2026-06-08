import type { ClienteSelectorOption } from "@/features/clientes/types";

interface SelectedClientCardProps {
  cliente: ClienteSelectorOption | null;
}

/**
 * Tarjeta única de cliente seleccionado.
 *
 * Esta tarjeta reemplaza:
 * - la tarjeta lateral duplicada;
 * - la tarjeta repetida debajo del buscador.
 */
export function SelectedClientCard({ cliente }: SelectedClientCardProps) {
  if (!cliente) {
    return (
      <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-6 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">
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
        <div>
          <p className="text-sm font-semibold text-violet-700">
            Cliente seleccionado
          </p>

          <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
            {cliente.nombre}
          </h3>

          <p className="mt-1 text-sm text-slate-600">C.C. {cliente.cedula}</p>
        </div>

        <span className="w-fit rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          Seleccionado
        </span>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <ClientField label="Teléfono" value={cliente.telefono} />
        <ClientField label="Dirección" value={cliente.direccion} />
        <ClientField label="Empresa" value={cliente.empresa} />
        <ClientField label="Recomienda" value={cliente.recomienda} />
        <ClientField label="Contacto" value={cliente.contacto} />
        <ClientField label="Contacto 2" value={cliente.contacto2} />
        <ClientField
          label="Estado documentos"
          value={formatEstadoDocumentos(cliente.estadoDocumentos)}
        />

        <div>
          <dt className="text-xs uppercase tracking-wide text-violet-400">
            Adjuntos
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {cliente.carpetaAdjuntosUrl ? (
              <a
                href={cliente.carpetaAdjuntosUrl}
                target="_blank"
                rel="noreferrer"
                className="text-violet-700 underline-offset-4 hover:underline"
              >
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
  label: string;
  value: string | null;
}

function ClientField({ label, value }: ClientFieldProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-violet-400">
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