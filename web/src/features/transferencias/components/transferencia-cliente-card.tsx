import { Users } from "lucide-react";

import { transferirClienteCompletoAction } from "../actions";
import type { TransferClienteOption, TransferOwnerOption } from "../queries";

interface TransferenciaClienteCardProps {
  owners: TransferOwnerOption[];
  clientes: TransferClienteOption[];
}

export function TransferenciaClienteCard({ owners, clientes }: TransferenciaClienteCardProps) {
  return (
    <section className="rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      <div className="border-b border-violet-100 pb-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-violet-700">
          <Users className="h-4 w-4" />
          Cliente completo
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
          Transferir cliente y todos sus créditos
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Cambia el propietario principal del cliente y mueve todos sus créditos al mismo destino.
        </p>
      </div>

      <form action={transferirClienteCompletoAction} className="mt-5 grid gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Cliente</span>
          <select name="clienteId" defaultValue="" className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15">
            <option value="" disabled>Selecciona cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre} - {cliente.cedula} - owner: {cliente.ownerNombre ?? "sin owner"} - créditos: {cliente.creditosTotal}
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
          <input name="reason" placeholder="Ej: cliente asignado a cartera de Martha" className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15" />
        </label>

        <button type="submit" className="inline-flex w-fit items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700">
          Transferir cliente completo
        </button>
      </form>
    </section>
  );
}
