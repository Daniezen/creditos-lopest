import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
      <section className="mb-5 flex flex-col justify-between gap-3 rounded-[2rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            Alta de cliente
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Registra datos básicos y de contacto del cliente.
          </p>
        </div>

        <Link
          href="/clientes"
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
      </section>

      <ClienteCreateForm />
    </main>
  );
}
