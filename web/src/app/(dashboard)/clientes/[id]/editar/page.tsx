import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { ClienteForm } from "@/features/clientes/components/cliente-form";
import { obtenerClienteDetalle } from "@/features/clientes/queries";

interface EditarClientePageProps {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Edición formal de cliente.
 *
 * La topbar global ya identifica el módulo Clientes, así que esta vista solo
 * muestra una banda compacta con contexto del registro editado.
 */
export default async function EditarClientePage({
  params,
}: EditarClientePageProps) {
  const { id } = await params;
  const cliente = await obtenerClienteDetalle(id);

  if (!cliente) {
    notFound();
  }

  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className={surfaceRecipes.pageHeaderBand}>
        <div>
          <p className={dataDisplayRecipes.eyebrow}>
            Editar cliente
          </p>
          <p className="mt-1 text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
            {cliente.nombre} · C.C. {cliente.cedula}
          </p>
        </div>

        <Link
          href={`/clientes/${cliente.id}`}
          className={actionRecipes.secondary}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al cliente
        </Link>
      </section>

      <ClienteForm cliente={cliente} />
    </main>
  );
}
