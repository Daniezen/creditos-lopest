import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";

import { ClienteCreateForm } from "@/features/clientes/components/cliente-create-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Página de creación de clientes.
 *
 * Esta vista elimina la dependencia de crear clientes únicamente desde
 * /creditos/nuevo. El alta rápida dentro del flujo de crédito puede seguir
 * existiendo, pero esta ruta es el flujo formal.
 */
export default function NuevoClientePage() {
  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <header className="mb-6 overflow-hidden rounded-[2rem] border border-violet-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_38%,#fff7ed_100%)] shadow-[0_18px_45px_rgba(109,40,217,0.10)]">
        <div className="flex flex-col justify-between gap-5 px-6 py-6 sm:px-7 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white/80 text-violet-700 shadow-sm shadow-violet-100 ring-1 ring-violet-100">
              <UserPlus className="h-7 w-7" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">
                Nuevo cliente
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                Crear cliente
              </h2>
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

      <ClienteCreateForm />
    </main>
  );
}
