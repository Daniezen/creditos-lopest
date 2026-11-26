"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { anularMovimientoAction, editarMovimientoAction } from "@/app/(casa-negocio)/casa-negocio/casa/actions";
import { cnCasaRecipes, cnDialogRecipes, cnFormRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { CuentaOpcion, MovimientoEditable, OpcionCategoria } from "@/server/casa-negocio/vista-casa";

import { Glyph } from "../shared/glyph";
import { Notice } from "../shared/notice";
import { avisoSinSaldo } from "./aviso-salida";
import { CampoFecha, CampoMonto, CampoSelect, CampoTexto, EstadoLinea, useEnvio } from "./campos";
import { FORMAS, MARCA_LIBRO, montoInicial, montoNumero, payloadDe, type ValoresMovimiento } from "./formas";

export interface OpcionesEdicion {
  cuentasCasa: CuentaOpcion[];
  cuentasNegocio: CuentaOpcion[];
  fijos: OpcionCategoria[];
  sobres: OpcionCategoria[];
  hoy: string;
  avisoSinSaldo: boolean;
}

const PENCIL = "M4 20h4L19 9l-4-4L4 16z";

/**
 * Where the focus lands once the dialog closed: back on the pencil that
 * opened it while that button is still on the page, otherwise (the row was
 * voided, or its new date moved it to another day) on the book itself, so
 * keyboard and screen-reader users are not dropped at the top of the page.
 */
export function destinoDelFoco(boton: HTMLElement | null, libro: HTMLElement | null, filaSeVa: boolean): HTMLElement | null {
  if (!filaSeVa && boton?.isConnected) return boton;
  return libro ?? boton;
}

/**
 * Edit and void one manual movement, in a native modal `<dialog>`: the
 * browser traps the focus inside it and closes it with Escape (also while a
 * request is in flight: the answer still refreshes the book). Both
 * operations send back the row's `version`: when someone changed it
 * meanwhile the service refuses and the dialog offers to reload instead of
 * overwriting. Voiding asks for a reason and a second, explicit confirmation.
 */
export function EditarMovimiento({ movimiento, nombre, opciones }: { movimiento: MovimientoEditable; nombre: string; opciones: OpcionesEdicion }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  // Looked up while the row still exists: after a void it is gone.
  const libro = useRef<HTMLElement | null>(null);
  const filaSeVa = useRef(false);
  const [modo, setModo] = useState<"editar" | "anular">("editar");
  // The dialog's content mounts only while open: a long book keeps one
  // closed <dialog> per row and no form state until someone edits.
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (abierto && !dialog.current?.open) dialog.current?.showModal();
  }, [abierto]);

  function abrir() {
    libro.current = boton.current?.closest<HTMLElement>(`[${MARCA_LIBRO}]`) ?? null;
    filaSeVa.current = false;
    setModo("editar");
    setAbierto(true);
  }
  const cerrar = () => dialog.current?.close();
  const alAnular = () => {
    filaSeVa.current = true;
    cerrar();
  };

  function alCerrar() {
    setAbierto(false);
    // The browser restores focus to the opener on close; one frame later
    // the refreshed book may have dropped or moved that row, so the target
    // is decided then.
    requestAnimationFrame(() => destinoDelFoco(boton.current, libro.current, filaSeVa.current)?.focus());
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={cnCasaRecipes.rowEdit}
        aria-label={`Editar ${nombre}`}
        aria-haspopup="dialog"
        onClick={abrir}
      >
        <Glyph path={PENCIL} className="size-4" strokeWidth={2.2} />
      </button>
      <dialog ref={dialog} className={cnDialogRecipes.dialog} aria-labelledby={`editar-${movimiento.id}`} onClose={alCerrar}>
        {!abierto ? null : modo === "editar" ? (
          <FormularioEdicion
            key={movimiento.version}
            movimiento={movimiento}
            nombre={nombre}
            opciones={opciones}
            onCerrar={cerrar}
            onAnular={() => setModo("anular")}
          />
        ) : (
          <ConfirmarAnulacion movimiento={movimiento} nombre={nombre} onAnulado={alAnular} onVolver={() => setModo("editar")} />
        )}
      </dialog>
    </>
  );
}

/**
 * Puts the focus on the first field when a step of the dialog mounts. On
 * first open `showModal` would do it anyway; it matters when switching
 * between «Editar» and «¿Anular?», because the button that was pressed
 * unmounts and the focus would otherwise fall out of the dialog.
 */
function useFocoInicial(formRef: React.RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, [formRef]);
}

function FormularioEdicion({
  movimiento,
  nombre,
  opciones,
  onCerrar,
  onAnular,
}: {
  movimiento: MovimientoEditable;
  nombre: string;
  opciones: OpcionesEdicion;
  onCerrar: () => void;
  onAnular: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<ValoresMovimiento>({
    tipo: movimiento.tipo,
    fecha: movimiento.fecha,
    monto: montoInicial(movimiento.monto),
    cuentaOrigenId: movimiento.cuentaOrigenId ?? "",
    cuentaDestinoId: movimiento.cuentaDestinoId ?? "",
    categoriaId: movimiento.categoriaId ?? "",
    nota: movimiento.nota ?? "",
  });
  const { pendiente, estado, enviar, limpiarCampo, formRef } = useEnvio<unknown>();
  const [conflicto, setConflicto] = useState(false);
  useFocoInicial(formRef);
  const forma = FORMAS[v.tipo];
  const e = estado.campos;
  const cuentas = (grupo: "CASA" | "NEGOCIO") => (grupo === "CASA" ? opciones.cuentasCasa : opciones.cuentasNegocio);
  const set = (campo: keyof ValoresMovimiento) => (valor: string) => {
    setV((prev) => ({ ...prev, [campo]: valor }));
    limpiarCampo(campo);
  };

  const origen = forma.origen ? cuentas(forma.origen.grupo).find((c) => c.id === v.cuentaOrigenId) : undefined;
  const devuelto = origen && origen.id === movimiento.cuentaOrigenId ? movimiento.monto : 0;
  const aviso = opciones.avisoSinSaldo && forma.sale ? avisoSinSaldo(origen, montoNumero(v.monto), devuelto) : null;

  function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    enviar(
      async () => {
        const r = await editarMovimientoAction({ movimientoId: movimiento.id, version: movimiento.version, ...payloadDe(v) });
        if (!r.ok) setConflicto(r.conflicto);
        return r;
      },
      () => onCerrar(),
    );
  }

  const categorias = forma.categoria?.clase === "FIJO" ? opciones.fijos : opciones.sobres;
  return (
    <form ref={formRef} onSubmit={guardar} noValidate className={cnDialogRecipes.body}>
      <h2 id={`editar-${movimiento.id}`} className={cnDialogRecipes.title}>
        Editar {nombre}
      </h2>
      <div className={cnDialogRecipes.fields}>
        {forma.categoria ? (
          <CampoSelect
            label={forma.categoria.label}
            name="categoriaId"
            value={v.categoriaId}
            onChange={set("categoriaId")}
            opciones={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
            error={e.categoriaId}
          />
        ) : null}
        <CampoMonto value={v.monto} onChange={set("monto")} error={e.monto} />
        {forma.origen ? (
          <CampoSelect
            label={forma.origen.label}
            name="cuentaOrigenId"
            value={v.cuentaOrigenId}
            onChange={set("cuentaOrigenId")}
            opciones={cuentas(forma.origen.grupo).map((c) => ({ value: c.id, label: c.nombre }))}
            error={e.cuentaOrigenId}
          />
        ) : null}
        {forma.destino ? (
          <CampoSelect
            label={forma.destino.label}
            name="cuentaDestinoId"
            value={v.cuentaDestinoId}
            onChange={set("cuentaDestinoId")}
            opciones={cuentas(forma.destino.grupo).map((c) => ({ value: c.id, label: c.nombre }))}
            error={e.cuentaDestinoId}
          />
        ) : null}
        {forma.nota ? (
          <CampoTexto
            label={forma.nota.label}
            name="nota"
            value={v.nota}
            onChange={set("nota")}
            placeholder={forma.nota.placeholder}
            sugerencias={forma.nota.sugerencias}
            error={e.nota}
          />
        ) : null}
        <CampoFecha value={v.fecha} onChange={set("fecha")} max={opciones.hoy} error={e.fecha} />
      </div>
      {aviso ? <Notice level="problema">{aviso}</Notice> : null}
      <div className={cnDialogRecipes.between}>
        <button type="button" className={cnFormRecipes.secondary} onClick={onAnular} disabled={pendiente}>
          Anular…
        </button>
        <div className={cnDialogRecipes.footer}>
          <button type="button" className={cnFormRecipes.secondary} onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </button>
          {conflicto ? (
            <button type="button" className={cnFormRecipes.submit} onClick={() => router.refresh()}>
              Recargar
            </button>
          ) : (
            <button type="submit" className={cnFormRecipes.submit} disabled={pendiente} aria-busy={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
      </div>
      <EstadoLinea estado={estado} />
    </form>
  );
}

function ConfirmarAnulacion({
  movimiento,
  nombre,
  onAnulado,
  onVolver,
}: {
  movimiento: MovimientoEditable;
  nombre: string;
  /** Closes the dialog knowing the row is about to leave the book. */
  onAnulado: () => void;
  onVolver: () => void;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [conflicto, setConflicto] = useState(false);
  const { pendiente, estado, enviar, limpiarCampo, formRef } = useEnvio<unknown>();
  useFocoInicial(formRef);

  function anular(ev: React.FormEvent) {
    ev.preventDefault();
    enviar(
      async () => {
        const r = await anularMovimientoAction({ movimientoId: movimiento.id, version: movimiento.version, motivo });
        if (!r.ok) setConflicto(r.conflicto);
        return r;
      },
      () => onAnulado(),
    );
  }

  return (
    <form ref={formRef} onSubmit={anular} noValidate className={cnDialogRecipes.body}>
      <h2 id={`editar-${movimiento.id}`} className={cnDialogRecipes.title}>
        ¿Anular {nombre}?
      </h2>
      <p className={cnDialogRecipes.text}>Deja de contar en las cuentas del mes. Queda registrado quién lo anuló y por qué.</p>
      <CampoTexto
        label="Motivo"
        name="motivo"
        value={motivo}
        onChange={(m) => {
          setMotivo(m);
          limpiarCampo("motivo");
        }}
        placeholder="Duplicado, error de monto…"
        error={estado.campos.motivo}
      />
      <div className={cnDialogRecipes.footer}>
        <button type="button" className={cnFormRecipes.secondary} onClick={onVolver} disabled={pendiente}>
          Volver
        </button>
        {conflicto ? (
          <button type="button" className={cnFormRecipes.submit} onClick={() => router.refresh()}>
            Recargar
          </button>
        ) : (
          <button type="submit" className={cnFormRecipes.danger} disabled={pendiente} aria-busy={pendiente}>
            {pendiente ? "Anulando…" : "Sí, anular"}
          </button>
        )}
      </div>
      <EstadoLinea estado={estado} />
    </form>
  );
}
