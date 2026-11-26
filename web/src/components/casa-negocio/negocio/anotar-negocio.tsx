"use client";

import { useState } from "react";

import { anotarMovimientoAction } from "@/app/(casa-negocio)/casa-negocio/casa/actions";
import { cnCardRecipes, cnFormRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { VistaNegocio } from "@/server/casa-negocio/vista-negocio";

import { Notice } from "../shared/notice";
import { avisoSinSaldo } from "../casa/aviso-salida";
import { CampoFecha, CampoMonto, CampoSelect, CampoTexto, EstadoLinea, useEnvio } from "../casa/campos";
import { FORMAS, montoNumero, payloadDe, type ValoresMovimiento } from "../casa/formas";

type TipoNegocio = "GASTO_NEGOCIO" | "APORTE" | "RETIRO_CASA" | "TRASLADO";

const TIPOS: { id: TipoNegocio; label: string }[] = [
  { id: "GASTO_NEGOCIO", label: "Gasto" },
  { id: "APORTE", label: "Aporte" },
  { id: "RETIRO_CASA", label: "A la casa" },
  { id: "TRASLADO", label: "Traslado" },
];

/**
 * «Anotar en el negocio» (`Negocio.dc.html`): gasto, aporte, a la casa and
 * traslado. Two-account kinds read «Sale de → Llega a». The destination of a
 * traslado never offers the origin account. Alert 7 is judged live on the
 * account the money leaves.
 */
export function AnotarNegocio({ formulario, hoy }: { formulario: VistaNegocio["formulario"]; hoy: string }) {
  const negocio = formulario.cuentasNegocio;
  const casa = formulario.cuentasCasa;
  const [v, setV] = useState<ValoresMovimiento>({
    tipo: "RETIRO_CASA",
    fecha: formulario.fechaPorDefecto,
    monto: "",
    cuentaOrigenId: negocio[0]?.id ?? "",
    cuentaDestinoId: casa[0]?.id ?? "",
    categoriaId: "",
    nota: "",
  });
  const { pendiente, estado, enviar, limpiarCampo, reiniciar, formRef } = useEnvio<unknown>();
  const forma = FORMAS[v.tipo];
  const e = estado.campos;
  const lista = (grupo: "CASA" | "NEGOCIO") => (grupo === "CASA" ? casa : negocio);

  const destinos = forma.destino
    ? lista(forma.destino.grupo).filter((c) => !(forma.origen && c.id === v.cuentaOrigenId))
    : [];
  const origen = forma.origen ? lista(forma.origen.grupo).find((c) => c.id === v.cuentaOrigenId) : undefined;
  const aviso = formulario.avisoSinSaldo && forma.sale ? avisoSinSaldo(origen, montoNumero(v.monto)) : null;

  const set = (campo: keyof ValoresMovimiento) => (valor: string) => {
    setV((prev) => {
      const next = { ...prev, [campo]: valor };
      // A traslado cannot land where it left: move the destination away.
      if (campo === "cuentaOrigenId" && next.tipo === "TRASLADO" && next.cuentaDestinoId === valor) {
        next.cuentaDestinoId = negocio.find((c) => c.id !== valor)?.id ?? "";
      }
      return next;
    });
    limpiarCampo(campo);
  };

  function cambiarTipo(tipo: TipoNegocio) {
    reiniciar();
    const f = FORMAS[tipo];
    setV((prev) => {
      const origenId = f.origen ? (lista(f.origen.grupo).some((c) => c.id === prev.cuentaOrigenId) ? prev.cuentaOrigenId : (lista(f.origen.grupo)[0]?.id ?? "")) : "";
      const destinos = f.destino ? lista(f.destino.grupo).filter((c) => c.id !== origenId) : [];
      return {
        ...prev,
        tipo,
        cuentaOrigenId: origenId,
        cuentaDestinoId: destinos.some((c) => c.id === prev.cuentaDestinoId) ? prev.cuentaDestinoId : (destinos[0]?.id ?? ""),
      };
    });
  }

  function anotar(ev: React.FormEvent) {
    ev.preventDefault();
    enviar(
      (operationKey) => anotarMovimientoAction({ operationKey, ...payloadDe(v) }),
      () => setV((prev) => ({ ...prev, monto: "", nota: "" })),
    );
  }

  const opciones = (cs: typeof negocio) => cs.map((c) => ({ value: c.id, label: c.nombre }));
  const sinCasa = v.tipo === "RETIRO_CASA" && casa.length === 0;
  const sinOtra = v.tipo === "TRASLADO" && negocio.length < 2;

  return (
    <section aria-labelledby="anotar-negocio" className={cnCardRecipes.card}>
      <form ref={formRef} onSubmit={anotar} noValidate className="contents">
        <div className={cnCardRecipes.head}>
          <h2 id="anotar-negocio" className={cnCardRecipes.title}>
            Anotar en el negocio
          </h2>
          <div role="group" aria-label="Movimiento" className={cnFormRecipes.segmented}>
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={v.tipo === t.id}
                className={`${cnFormRecipes.segment} ${cnFormRecipes.segmentNegocio}`}
                onClick={() => cambiarTipo(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className={cnFormRecipes.lead}>Los cobros y los préstamos no se anotan aquí: llegan solos desde Créditos.</p>

        <div className={cnFormRecipes.fields}>
          <CampoMonto value={v.monto} onChange={set("monto")} error={e.monto} />
          {forma.origen ? (
            <CampoSelect
              label={forma.origen.label}
              name="cuentaOrigenId"
              value={v.cuentaOrigenId}
              onChange={set("cuentaOrigenId")}
              opciones={opciones(lista(forma.origen.grupo))}
              error={e.cuentaOrigenId}
            />
          ) : null}
          {forma.destino ? (
            <CampoSelect
              label={forma.destino.label}
              name="cuentaDestinoId"
              value={v.cuentaDestinoId}
              onChange={set("cuentaDestinoId")}
              opciones={opciones(destinos)}
              vacio={destinos.length === 0 ? "No hay otra cuenta" : undefined}
              error={e.cuentaDestinoId}
            />
          ) : null}
          {forma.nota ? (
            <CampoTexto label={forma.nota.label} name="nota" value={v.nota} onChange={set("nota")} placeholder={forma.nota.placeholder} error={e.nota} />
          ) : null}
          <CampoFecha value={v.fecha} onChange={set("fecha")} max={hoy} min={origen?.desde} error={e.fecha} />
        </div>

        {aviso ? <Notice level="problema">{aviso}</Notice> : null}
        {sinCasa ? <Notice level="atencion">Falta una cuenta de la casa para llevar la plata.</Notice> : null}
        {sinOtra ? <Notice level="atencion">Para un traslado hacen falta dos cuentas del negocio.</Notice> : null}

        <div className={cnFormRecipes.footer}>
          <EstadoLinea estado={estado} />
          <button type="submit" className={cnFormRecipes.submit} disabled={pendiente || sinCasa || sinOtra} aria-busy={pendiente}>
            {pendiente ? "Anotando…" : "Anotar"}
          </button>
        </div>
      </form>
    </section>
  );
}
