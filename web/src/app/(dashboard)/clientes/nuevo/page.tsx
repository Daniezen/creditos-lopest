import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { actionRecipes } from "@/design-system/recipes/actions";
import { dataDisplayRecipes } from "@/design-system/recipes/data-display";
import { surfaceRecipes } from "@/design-system/recipes/surfaces";
import { ClienteCreateForm } from "@/features/clientes/components/cliente-create-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Página formal de creación de clientes.
 *
 * La topbar ya identifica la sección Clientes; esta vista solo presenta una
 * banda compacta de acción y el formulario.
 */
export default function NuevoClientePage() {
  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className={surfaceRecipes.pageHeaderBand}>
        <div>
          <p className={dataDisplayRecipes.eyebrow}>
            Alta de cliente
          </p>
          <p className="mt-1 text-sm font-[var(--font-weight-body)] text-[var(--color-text-secondary)]">
            Registra datos básicos y de contacto del cliente.
          </p>
        </div>

        <Link
          href="/clientes"
          className={actionRecipes.secondary}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
      </section>

      <ClienteCreateForm />
    </main>
  );
}
