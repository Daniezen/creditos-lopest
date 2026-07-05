import { ShieldCheck, UserRound } from "lucide-react";

import { transferirClienteOwnerAction } from "../admin-actions";
import type { UsuarioOperadorActivoItem } from "../admin-queries";

interface ClienteOwnerTransferCardProps {
  clienteId: string;
  currentOwnerUserId: string | null;
  operadores: UsuarioOperadorActivoItem[];
}

/**
 * Tarjeta administrativa para transferir propietario operativo del cliente.
 *
 * Es un componente de servidor con form action. No usa estado cliente porque la
 * operacion debe validarse y auditarse completamente en servidor.
 */
export function ClienteOwnerTransferCard({
  clienteId,
  currentOwnerUserId,
  operadores,
}: ClienteOwnerTransferCardProps) {
  const ownerActual =
    operadores.find((operador) => operador.id === currentOwnerUserId) ?? null;

  return (
    <section className="mb-5 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            <ShieldCheck className="h-4 w-4" />
            Administración
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            Propietario del cliente
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Transfiere la visibilidad operativa del cliente. Sus créditos,
            cuotas y documentos permanecen asociados al mismo cliente.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="rounded-2xl border border-violet-100 bg-[#fbfaff] p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <UserRound className="h-3.5 w-3.5 text-violet-600" />
            Propietario actual
          </p>
          <p className="mt-2 font-black text-slate-950">
            {ownerActual?.nombre ?? "Sin propietario reconocido"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {ownerActual?.email ?? currentOwnerUserId ?? "ownerUserId vacío"}
          </p>
        </div>

        <form action={transferirClienteOwnerAction} className="grid gap-3">
          <input type="hidden" name="clienteId" value={clienteId} />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Nuevo propietario
            </span>
            <select
              name="targetOwnerUserId"
              defaultValue=""
              className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
            >
              <option value="" disabled>
                Selecciona usuario
              </option>
              {operadores.map((operador) => (
                <option
                  key={operador.id}
                  value={operador.id}
                  disabled={operador.id === currentOwnerUserId}
                >
                  {operador.nombre} - {operador.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Motivo opcional
            </span>
            <input
              name="reason"
              placeholder="Ej: asignación a cartera de Martha"
              className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
            />
          </label>

          <button
            type="submit"
            className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700"
          >
            Transferir cliente
          </button>
        </form>
      </div>
    </section>
  );
}
