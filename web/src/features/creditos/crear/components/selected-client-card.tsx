import type { ComponentType } from "react";
import {
  AlertTriangle,
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

import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { statusRecipes } from "@/design-system/recipes/status";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import type { ClienteSelectorOption } from "@/features/clientes/types";

interface SelectedClientCardProps {
  cliente: ClienteSelectorOption | null;
}

/**
 * Tarjeta única de cliente seleccionado.
 *
 * Si el perfil está incompleto, muestra una alerta de negocio.
 * No bloquea el flujo todavía.
 */
export function SelectedClientCard({ cliente }: SelectedClientCardProps) {
  if (!cliente) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)]/80 p-6 text-center shadow-[var(--ds-shadow-surface)]">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-selection)] text-[var(--color-selection-strong)]">
          <UserRound className="h-5 w-5" />
        </div>

        <h3 className="mt-3 text-sm font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
          Cliente pendiente
        </h3>

        <p className="mx-auto mt-1 max-w-md text-xs font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
          Selecciona un cliente para continuar.
        </p>
      </section>
    );
  }

  const perfilIncompleto = isClienteProfileIncomplete(cliente);

  return (
    <section className={surfaceRecipes.card}>
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4 sm:flex-row sm:items-start">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-selection)] text-[var(--color-selection-strong)] shadow-[var(--ds-shadow-surface)]">
            <UserRound className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-[var(--font-weight-label)] text-[var(--color-selection-strong)]">
              Cliente seleccionado
            </p>

            <h3 className="mt-0.5 text-base font-[var(--font-weight-heading)] text-[var(--color-text-primary)]">
              {cliente.nombre}
            </h3>

            <p className="mt-0.5 text-xs font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
              C.C. {cliente.cedula}
            </p>
          </div>
        </div>

        <span className={statusRecipes.vigente}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Seleccionado
        </span>
      </div>

      {perfilIncompleto ? (
        <div className={surfaceRecipes.alertWarning}>
          <div className="flex gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Perfil pendiente de completar. El crédito puede continuar, pero la
              información del cliente deberá completarse después desde Clientes.
            </p>
          </div>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-3">
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
          <dt className="flex items-center gap-1.5 font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
            <FolderOpen className="h-3.5 w-3.5 text-[var(--color-action-primary)]" />
            Adjuntos
          </dt>

          <dd className="mt-1 font-[var(--font-weight-data-emphasis)] text-[var(--color-text-primary)]">
            {cliente.carpetaAdjuntosUrl ? (
              <a
                href={cliente.carpetaAdjuntosUrl}
                target="_blank"
                rel="noreferrer"
                className={dataDisplayRecipes.entityLink}
              >
                <FolderOpen className="h-3.5 w-3.5" />
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
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}

function ClientField({ icon: Icon, label, value }: ClientFieldProps) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-[var(--font-weight-label)] text-[var(--color-text-secondary)]">
        <Icon className="h-3.5 w-3.5 text-[var(--color-action-primary)]" />
        {label}
      </dt>
      <dd className="mt-1 font-[var(--font-weight-data-emphasis)] text-[var(--color-text-primary)]">{value || "-"}</dd>
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

  if (value === "SIN_DOCUMENTOS") {
    return "Sin documentos";
  }

  return value;
}

function isClienteProfileIncomplete(cliente: ClienteSelectorOption): boolean {
  return (
    !cliente.telefono ||
    !cliente.direccion ||
    !cliente.empresa ||
    !cliente.recomienda ||
    !cliente.contacto ||
    !cliente.contacto2
  );
}
