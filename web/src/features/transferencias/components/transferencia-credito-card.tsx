import { CreditCard } from "lucide-react";

import { formatCurrencyCOP } from "@/lib/formatters";

import { transferirCreditoIndividualAction } from "../actions";
import type { TransferCreditoOption, TransferOwnerOption } from "../queries";

interface TransferenciaCreditoCardProps {
  owners: TransferOwnerOption[];
  creditos: TransferCreditoOption[];
}

export function TransferenciaCreditoCard({ owners, creditos }: TransferenciaCreditoCardProps) {
  return (
    <section className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      <div className="border-b border-violet-100 pb-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-violet-700">
          <CreditCard className="h-4 w-4" />
          Crédito individual
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
          Transferir solo un crédito
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          No cambia el propietario principal del cliente. Solo mueve la cartera de ese crédito.
        </p>
      </div>

      <form action={transferirCreditoIndividualAction} className="mt-5 grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Crédito</span>
          <select name="creditoId" defaultValue="" className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15">
            <option value="" disabled>Selecciona crédito</option>
            {creditos.map((credito) => (
              <option key={credito.id} value={credito.id}>
                {credito.codigo} - {credito.clienteNombre} - {formatCurrencyCOP(credito.monto)} - owner: {credito.ownerNombre ?? "sin owner"}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Destino</span>
          <select name="targetOwnerUserId" defaultValue="" className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15">
            <option value="" disabled>Selecciona propietario destino</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.nombre} - {owner.email}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Motivo opcional</span>
          <input name="reason" placeholder="Ej: crédito asignado a cartera de Martha" className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15" />
        </label>

        <button type="submit" className="inline-flex w-fit items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700">
          Transferir crédito
        </button>
      </form>
    </section>
  );
}
