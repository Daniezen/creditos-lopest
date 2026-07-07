"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRightLeft, CreditCard, Search, Users } from "lucide-react";

import { formatCurrencyCOP } from "@/lib/formatters";

import {
  transferirClienteCompletoAction,
  transferirCreditoIndividualAction,
} from "../actions";
import type {
  TransferClienteOption,
  TransferCreditoOption,
  TransferOwnerOption,
  TransferenciasContext,
} from "../queries";

interface TransferenciasPageContentProps {
  context: TransferenciasContext;
}

interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  emptyMessage: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function SearchableSelect({
  label,
  placeholder,
  emptyMessage,
  options,
  value,
  onChange,
  disabled = false,
}: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    if (!normalizedQuery) {
      return options.slice(0, 80);
    }

    return options
      .filter((option) => {
        return normalizeSearch(`${option.label} ${option.description ?? ""}`).includes(
          normalizedQuery,
        );
      })
      .slice(0, 80);
  }, [options, query]);

  function handleSelect(option: SearchableSelectOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <label className="relative block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
          }}
          className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {open && !disabled ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-violet-100 bg-white p-1 shadow-xl shadow-violet-950/10">
          {filteredOptions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
                className="block w-full rounded-xl px-4 py-3 text-left transition hover:bg-violet-50"
              >
                <span className="block text-sm font-bold text-slate-950">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.description}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </label>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function ownerDescription(owner: TransferOwnerOption): string {
  return owner.email;
}

function clienteLabel(cliente: TransferClienteOption): string {
  return `${cliente.nombre} - ${cliente.cedula}`;
}

function clienteDescription(cliente: TransferClienteOption): string {
  return `Propietario: ${cliente.ownerNombre ?? "sin propietario"} | Créditos: ${cliente.creditosTotal}`;
}

function creditoLabel(credito: TransferCreditoOption): string {
  return `${credito.codigo} - ${credito.clienteNombre}`;
}

function creditoDescription(credito: TransferCreditoOption): string {
  return `${formatCurrencyCOP(credito.monto)} | Propietario: ${credito.ownerNombre ?? "sin propietario"}`;
}

export function TransferenciasPageContent({ context }: TransferenciasPageContentProps) {
  const [clienteCompletoId, setClienteCompletoId] = useState("");
  const [clienteCompletoDestinoId, setClienteCompletoDestinoId] = useState("");
  const [creditoClienteId, setCreditoClienteId] = useState("");
  const [creditoId, setCreditoId] = useState("");
  const [creditoDestinoId, setCreditoDestinoId] = useState("");

  const selectedClienteCompleto =
    context.clientes.find((cliente) => cliente.id === clienteCompletoId) ?? null;

  const selectedCreditoCliente =
    context.clientes.find((cliente) => cliente.id === creditoClienteId) ?? null;

  const creditosDelCliente = useMemo(() => {
    if (!creditoClienteId) {
      return [];
    }

    return context.creditos.filter((credito) => credito.clienteId === creditoClienteId);
  }, [context.creditos, creditoClienteId]);

  const selectedCredito =
    creditosDelCliente.find((credito) => credito.id === creditoId) ?? null;

  const clienteOptions = context.clientes.map((cliente) => ({
    value: cliente.id,
    label: clienteLabel(cliente),
    description: clienteDescription(cliente),
  }));

  const ownersForClienteCompleto = context.owners.filter(
    (owner) => owner.id !== selectedClienteCompleto?.ownerUserId,
  );

  const ownersForCredito = context.owners.filter(
    (owner) => owner.id !== selectedCredito?.ownerUserId,
  );

  const ownerOptionsForClienteCompleto = ownersForClienteCompleto.map((owner) => ({
    value: owner.id,
    label: owner.nombre,
    description: ownerDescription(owner),
  }));

  const ownerOptionsForCredito = ownersForCredito.map((owner) => ({
    value: owner.id,
    label: owner.nombre,
    description: ownerDescription(owner),
  }));

  const creditosOptions = creditosDelCliente.map((credito) => ({
    value: credito.id,
    label: creditoLabel(credito),
    description: creditoDescription(credito),
  }));

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
            <input type="hidden" name="clienteId" value={clienteCompletoId} />
            <input type="hidden" name="targetOwnerUserId" value={clienteCompletoDestinoId} />

            <SearchableSelect
              label="Cliente"
              placeholder="Buscar cliente por nombre, cédula o propietario"
              emptyMessage="No se encontraron clientes."
              options={clienteOptions}
              value={clienteCompletoId}
              onChange={(value) => {
                setClienteCompletoId(value);
                setClienteCompletoDestinoId("");
              }}
            />

            <SearchableSelect
              label="Destino"
              placeholder={
                selectedClienteCompleto
                  ? "Buscar propietario destino"
                  : "Primero selecciona un cliente"
              }
              emptyMessage="No hay propietarios destino disponibles."
              options={ownerOptionsForClienteCompleto}
              value={clienteCompletoDestinoId}
              onChange={setClienteCompletoDestinoId}
              disabled={!selectedClienteCompleto}
            />

            <FieldShell label="Motivo opcional">
              <input
                name="reason"
                placeholder="Ej: cliente asignado a cartera de Martha"
                className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
            </FieldShell>

            <button
              type="submit"
              disabled={!clienteCompletoId || !clienteCompletoDestinoId}
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Transferir cliente completo
            </button>
          </form>
        </section>

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
              Selecciona primero el cliente y luego el crédito asociado que vas a transferir.
            </p>
          </div>

          <form action={transferirCreditoIndividualAction} className="mt-5 grid gap-4">
            <input type="hidden" name="creditoId" value={creditoId} />
            <input type="hidden" name="targetOwnerUserId" value={creditoDestinoId} />

            <SearchableSelect
              label="Cliente"
              placeholder="Buscar cliente por nombre, cédula o propietario"
              emptyMessage="No se encontraron clientes."
              options={clienteOptions}
              value={creditoClienteId}
              onChange={(value) => {
                setCreditoClienteId(value);
                setCreditoId("");
                setCreditoDestinoId("");
              }}
            />

            <SearchableSelect
              label="Crédito"
              placeholder={
                selectedCreditoCliente
                  ? "Buscar crédito por código, cliente o propietario"
                  : "Primero selecciona un cliente"
              }
              emptyMessage="Este cliente no tiene créditos transferibles en este alcance."
              options={creditosOptions}
              value={creditoId}
              onChange={(value) => {
                setCreditoId(value);
                setCreditoDestinoId("");
              }}
              disabled={!selectedCreditoCliente}
            />

            <SearchableSelect
              label="Destino"
              placeholder={selectedCredito ? "Buscar propietario destino" : "Primero selecciona un crédito"}
              emptyMessage="No hay propietarios destino disponibles."
              options={ownerOptionsForCredito}
              value={creditoDestinoId}
              onChange={setCreditoDestinoId}
              disabled={!selectedCredito}
            />

            <FieldShell label="Motivo opcional">
              <input
                name="reason"
                placeholder="Ej: crédito asignado a cartera de Martha"
                className="w-full rounded-2xl border border-violet-100 bg-[#fbfaff] px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
            </FieldShell>

            <button
              type="submit"
              disabled={!creditoId || !creditoDestinoId}
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Transferir crédito
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
