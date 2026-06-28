import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
      <section className="mb-5 flex flex-col justify-between gap-3 rounded-[2rem] border border-violet-100 bg-white/90 p-4 shadow-sm shadow-violet-100/40 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            Editar cliente
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {cliente.nombre} · C.C. {cliente.cedula}
          </p>
        </div>

        <Link
          href={`/clientes/${cliente.id}`}
          className="inline-flex w-fit items-center gap-2 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al cliente
        </Link>
      </section>

      <ClienteForm cliente={cliente} />
    </main>
  );
}
