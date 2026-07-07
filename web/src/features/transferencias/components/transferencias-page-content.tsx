import type { TransferenciasContext } from "../queries";

import { TransferenciaClienteCard } from "./transferencia-cliente-card";
import { TransferenciaCreditoCard } from "./transferencia-credito-card";

interface TransferenciasPageContentProps {
  context: TransferenciasContext;
}

export function TransferenciasPageContent({ context }: TransferenciasPageContentProps) {
  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-violet-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="border-b border-violet-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0%,#faf5ff_42%,#fff7ed_100%)] px-6 py-5 sm:px-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            Transferencias de cartera
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Clientes y créditos entre cuentas
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Mueve clientes completos con todos sus créditos, o créditos individuales
            para compartir un cliente entre Germán y Martha con carteras separadas.
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <TransferenciaClienteCard
          owners={context.owners}
          clientes={context.clientes}
        />
        <TransferenciaCreditoCard
          owners={context.owners}
          creditos={context.creditos}
        />
      </div>
    </main>
  );
}
