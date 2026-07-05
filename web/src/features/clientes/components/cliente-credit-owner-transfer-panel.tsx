import { ArrowRightLeft, CreditCard, UserRound } from "lucide-react";

import { formatCurrencyCOP } from "@/lib/formatters";
import { transferirCreditoOwnerAction } from "@/features/creditos/admin-actions";

import type { UsuarioOperadorActivoItem } from "../admin-queries";

interface CreditoTransferItem {
  id: string;
  codigo: string;
  estado: string;
  monto: unknown;
  ownerUserId: string | null;
}

interface ClienteCreditOwnerTransferPanelProps {
  creditos: CreditoTransferItem[];
  operadores: UsuarioOperadorActivoItem[];
}

/**
 * Panel administrativo para transferir creditos individuales dentro del detalle
 * de un cliente.
 *
 * La UI vive en clientes porque compone la vista /clientes/[id].
 * La mutacion vive en creditos porque modifica Credito.ownerUserId.
 */
export function ClienteCreditOwnerTransferPanel({
  creditos,
  operadores,
}: ClienteCreditOwnerTransferPanelProps) {
  if (creditos.length === 0) {
    return null;
  }

  return (
    <section className="mb-5 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-sm shadow-violet-100/40">
      <div className="flex flex-col justify-between gap-3 border-b border-violet-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-violet-700">
            <ArrowRightLeft className="h-4 w-4" />
            Administracion
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            Transferencia individual de creditos
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Mueve creditos especificos a otra cuenta sin transferir el cliente
            completo. Esto permite que el cliente quede compartido entre
            propietarios con carteras separadas.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {creditos.map((credito) => {
          const ownerActual =
            operadores.find((operador) => operador.id === credito.ownerUserId) ??
            null;

          return (
            <article
              key={credito.id}
              className="grid gap-4 rounded-2xl border border-violet-100 bg-[#fbfaff] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-end"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <CreditCard className="h-3.5 w-3.5 text-violet-600" />
                  Credito
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p className="font-black text-violet-700">{credito.codigo}</p>
                  <p className="text-sm font-semibold text-slate-950">
                    {formatCurrencyCOP(Number(credito.monto))}
                  </p>
                  <span className="rounded-full border border-violet-100 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {credito.estado === "ACTIVO" ? "Activo" : "Cancelado"}
                  </span>
                </div>

                <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <UserRound className="h-4 w-4 text-violet-600" />
                  <span>
                    Propietario actual: {ownerActual?.nombre ?? "Sin propietario reconocido"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {ownerActual?.email ?? credito.ownerUserId ?? "ownerUserId vacio"}
                </p>
              </div>

              <form action={transferirCreditoOwnerAction} className="grid gap-3">
                <input type="hidden" name="creditoId" value={credito.id} />

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nuevo propietario del credito
                  </span>
                  <select
                    name="targetOwnerUserId"
                    defaultValue=""
                    className="w-full rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
                  >
                    <option value="" disabled>
                      Selecciona usuario
                    </option>
                    {operadores.map((operador) => (
                      <option
                        key={operador.id}
                        value={operador.id}
                        disabled={operador.id === credito.ownerUserId}
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
                    placeholder="Ej: credito asignado a cartera de Martha"
                    className="w-full rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-violet-100 transition hover:bg-violet-700"
                >
                  Transferir credito
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}
