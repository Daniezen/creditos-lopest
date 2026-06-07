"use client";

import { useMemo, useState, useTransition } from "react";

import { crearClienteMinimo } from "@/features/clientes/actions";

import type { ClienteSelectorOption } from "@/features/clientes/types";

interface ClientStepProps {
  clientes: ClienteSelectorOption[];
  selectedCliente: ClienteSelectorOption | null;
  onSelectCliente: (cliente: ClienteSelectorOption) => void;
  onClienteCreado: (cliente: ClienteSelectorOption) => void;
}

/**
 * Paso 1 del wizard de creación de crédito.
 *
 * Permite:
 * - buscar cliente existente;
 * - seleccionar cliente;
 * - crear cliente mínimo/ampliado si no existe.
 */
export function ClientStep({
  clientes,
  selectedCliente,
  onSelectCliente,
  onClienteCreado,
}: ClientStepProps) {
  const [query, setQuery] = useState("");

  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [recomienda, setRecomienda] = useState("");
  const [contacto, setContacto] = useState("");
  const [contacto2, setContacto2] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientesFiltrados = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return clientes.slice(0, 20);
    }

    return clientes
      .filter((cliente) => {
        const searchable = [
          cliente.nombre,
          cliente.cedula,
          cliente.telefono ?? "",
          cliente.empresa ?? "",
          cliente.direccion ?? "",
          cliente.recomienda ?? "",
          cliente.contacto ?? "",
          cliente.contacto2 ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .slice(0, 20);
  }, [clientes, query]);

  function handleCrearCliente() {
    setError(null);

    startTransition(async () => {
      const result = await crearClienteMinimo({
        cedula,
        nombre,
        direccion,
        empresa,
        telefono,
        recomienda,
        contacto,
        contacto2,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onClienteCreado(result.cliente);
      onSelectCliente(result.cliente);

      setCedula("");
      setNombre("");
      setDireccion("");
      setEmpresa("");
      setTelefono("");
      setRecomienda("");
      setContacto("");
      setContacto2("");

      setQuery(`${result.cliente.cedula} ${result.cliente.nombre}`);
    });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">
            Seleccionar cliente existente
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Busca por nombre, cédula, teléfono, empresa, dirección o contacto.
            El crédito real no se podrá guardar sin cliente seleccionado.
          </p>
        </div>

        <div className="mt-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Buscar cliente
            </span>

            <input
              type="text"
              value={query}
              placeholder="Ej: cédula, nombre, teléfono o empresa"
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {clientesFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              No se encontraron clientes con ese criterio.
            </div>
          ) : null}

          {clientesFiltrados.map((cliente) => {
            const isSelected = selectedCliente?.id === cliente.id;

            return (
              <button
                key={cliente.id}
                type="button"
                onClick={() => onSelectCliente(cliente)}
                className={[
                  "w-full rounded-2xl border p-4 text-left transition",
                  isSelected
                    ? "border-violet-300 bg-violet-50 ring-2 ring-violet-500/10"
                    : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50",
                ].join(" ")}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {cliente.nombre}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      C.C. {cliente.cedula}
                    </p>
                  </div>

                  {isSelected ? (
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                      Seleccionado
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                  <p>Teléfono: {cliente.telefono || "-"}</p>
                  <p>Empresa: {cliente.empresa || "-"}</p>
                  <p>Dirección: {cliente.direccion || "-"}</p>
                  <p>Contacto: {cliente.contacto || "-"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="rounded-3xl border border-violet-200 bg-violet-50 p-6">
        <h3 className="text-lg font-semibold text-violet-950">
          Crear cliente
        </h3>

        <p className="mt-2 text-sm leading-6 text-violet-800">
          Usa esta opción solo si el cliente todavía no existe. La información
          podrá editarse después desde el módulo Clientes.
        </p>

        <div className="mt-5 space-y-4">
          <ClientInput label="Cédula" value={cedula} onChange={setCedula} />
          <ClientInput label="Nombre" value={nombre} onChange={setNombre} />
          <ClientInput
            label="Dirección"
            value={direccion}
            onChange={setDireccion}
          />
          <ClientInput label="Empresa" value={empresa} onChange={setEmpresa} />
          <ClientInput
            label="Teléfono"
            value={telefono}
            onChange={setTelefono}
          />
          <ClientInput
            label="Recomienda"
            value={recomienda}
            onChange={setRecomienda}
          />
          <ClientInput
            label="Contacto"
            value={contacto}
            onChange={setContacto}
          />
          <ClientInput
            label="Contacto 2"
            value={contacto2}
            onChange={setContacto2}
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleCrearCliente}
          disabled={isPending}
          className="mt-5 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending ? "Creando..." : "Crear y seleccionar"}
        </button>
      </aside>
    </section>
  );
}

interface ClientInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ClientInput({ label, value, onChange }: ClientInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-violet-950">
        {label}
      </span>

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        placeholder={label}
      />
    </label>
  );
}