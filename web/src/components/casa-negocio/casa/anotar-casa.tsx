"use client";

import { useState } from "react";

import { anotarMovimientoAction } from "@/app/(casa-negocio)/casa-negocio/casa/actions";
import { cnCardRecipes, cnFormRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { VistaCasa } from "@/server/casa-negocio/vista-casa";

import { formatMoney } from "../shared/format";
import { Notice } from "../shared/notice";
import { avisoSinSaldo } from "./aviso-salida";
import { CampoFecha, CampoMonto, CampoSelect, CampoTexto, EstadoLinea, useEnvio } from "./campos";
import { FORMAS, montoInicial, montoNumero, payloadDe } from "./formas";

type TipoCasa = "GASTO_FIJO" | "GASTO_VARIABLE" | "INGRESO_CASA";

const TIPOS: { id: TipoCasa; label: string }[] = [
  { id: "GASTO_FIJO", label: "Fijo" },
  { id: "GASTO_VARIABLE", label: "Variable" },
  { id: "INGRESO_CASA", label: "Ingreso" },
];

export interface AnotarCasaProps {
  formulario: VistaCasa["formulario"];
  /** Today: no movement may be dated after it. */
  hoy: string;
  /** Fixed expense to start on (the «Pagar» link of a month mark: `?categoria=`). */
  fijoInicial?: string;
}

/**
 * «Anotar en la casa» (`Casa.dc.html`): Fijo / Variable / Ingreso, the unpaid
 * fijos as chips that pre-fill name and amount, then the fields in the
 * canvas order (what, amount, account, date) and «Anotar» bottom right.
 */
export function AnotarCasa({ formulario, hoy, fijoInicial }: AnotarCasaProps) {
  const inicial = formulario.pendientes.find((p) => p.categoriaId === fijoInicial) ?? formulario.pendientes[0];
  const [tipo, setTipo] = useState<TipoCasa>("GASTO_FIJO");
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? formulario.fijos[0]?.id ?? "");
  const [monto, setMonto] = useState(inicial ? montoInicial(inicial.pendiente) : "");
  const [cuentaId, setCuentaId] = useState(formulario.cuentas[0]?.id ?? "");
  const [fecha, setFecha] = useState(formulario.fechaPorDefecto);
  const [nota, setNota] = useState("");
  const { pendiente, estado, enviar, limpiarCampo, reiniciar } = useEnvio<{ saldoOrigenDespues: number | null }>();

  const forma = FORMAS[tipo];
  const opciones = (tipo === "GASTO_FIJO" ? formulario.fijos : formulario.sobres).map((o) => ({ value: o.id, label: o.etiqueta }));
  const cuenta = formulario.cuentas.find((c) => c.id === cuentaId);
  const aviso = formulario.avisoSinSaldo && forma.sale ? avisoSinSaldo(cuenta, montoNumero(monto)) : null;
  const e = estado.campos;

  function cambiarTipo(nuevo: TipoCasa) {
    setTipo(nuevo);
    reiniciar();
    if (nuevo === "GASTO_FIJO") {
      const p = formulario.pendientes[0];
      setCategoriaId(p?.categoriaId ?? formulario.fijos[0]?.id ?? "");
      setMonto(p ? montoInicial(p.pendiente) : "");
    } else {
      setCategoriaId(nuevo === "GASTO_VARIABLE" ? (formulario.sobres[0]?.id ?? "") : "");
      setMonto("");
    }
  }

  function elegirCategoria(id: string) {
    setCategoriaId(id);
    limpiarCampo("categoriaId");
    if (tipo !== "GASTO_FIJO") return;
    const pend = formulario.pendientes.find((p) => p.categoriaId === id);
    const fijo = formulario.fijos.find((f) => f.id === id);
    const sugerido = pend?.pendiente ?? fijo?.monto ?? null;
    if (sugerido) setMonto(montoInicial(sugerido));
  }

  function anotar(ev: React.FormEvent) {
    ev.preventDefault();
    const valores = { tipo, fecha, monto, cuentaOrigenId: cuentaId, cuentaDestinoId: cuentaId, categoriaId, nota };
    enviar(
      (operationKey) => anotarMovimientoAction({ operationKey, ...payloadDe(valores) }),
      () => {
        setMonto("");
        setNota("");
      },
    );
  }

  return (
    <section aria-labelledby="anotar-casa" className={cnCardRecipes.card}>
      <form onSubmit={anotar} noValidate className="contents">
        <div className={cnCardRecipes.head}>
          <h2 id="anotar-casa" className={cnCardRecipes.title}>
            Anotar en la casa
          </h2>
          <div role="group" aria-label="Tipo" className={cnFormRecipes.segmented}>
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tipo === t.id}
                className={`${cnFormRecipes.segment} ${cnFormRecipes.segmentCasa}`}
                onClick={() => cambiarTipo(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tipo === "GASTO_FIJO" && formulario.pendientes.length > 0 ? (
          <div role="group" aria-label="Fijos sin pagar" className={cnFormRecipes.chips}>
            <span className={cnFormRecipes.chipsLabel}>Sin pagar:</span>
            {formulario.pendientes.map((p) => (
              <button
                key={p.categoriaId}
                type="button"
                aria-pressed={categoriaId === p.categoriaId}
                className={cnFormRecipes.chip}
                onClick={() => elegirCategoria(p.categoriaId)}
              >
                {p.nombre} · {formatMoney(p.pendiente)}
                {p.vencido ? <span className="sr-only"> (vencido)</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className={cnFormRecipes.fields}>
          {forma.categoria ? (
            <CampoSelect
              label={forma.categoria.label}
              name="categoriaId"
              value={categoriaId}
              onChange={elegirCategoria}
              opciones={opciones}
              vacio={opciones.length === 0 ? "No hay gastos configurados" : undefined}
              error={e.categoriaId}
            />
          ) : (
            <CampoTexto
              label={forma.nota!.label}
              name="nota"
              value={nota}
              onChange={(v) => {
                setNota(v);
                limpiarCampo("nota");
              }}
              placeholder={forma.nota!.placeholder}
              sugerencias={forma.nota!.sugerencias}
              error={e.nota}
            />
          )}
          <CampoMonto
            value={monto}
            onChange={(v) => {
              setMonto(v);
              limpiarCampo("monto");
            }}
            error={e.monto}
          />
          <CampoSelect
            label={(forma.origen ?? forma.destino)!.label}
            name="cuenta"
            value={cuentaId}
            onChange={setCuentaId}
            opciones={formulario.cuentas.map((c) => ({ value: c.id, label: c.nombre }))}
            error={e.cuentaOrigenId || e.cuentaDestinoId}
          />
          <CampoFecha
            value={fecha}
            onChange={(v) => {
              setFecha(v);
              limpiarCampo("fecha");
            }}
            max={hoy}
            min={cuenta?.desde}
            error={e.fecha}
          />
        </div>

        {aviso ? <Notice level="problema">{aviso}</Notice> : null}

        <div className={cnFormRecipes.footer}>
          <EstadoLinea estado={estado} />
          <button type="submit" className={cnFormRecipes.submit} disabled={pendiente} aria-busy={pendiente}>
            {pendiente ? "Anotando…" : "Anotar"}
          </button>
        </div>
      </form>
    </section>
  );
}
