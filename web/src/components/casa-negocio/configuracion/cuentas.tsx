"use client";

import { useState } from "react";

import {
  archivarCuentaAction,
  crearCuentaAction,
  editarConfiguracionAction,
  editarCuentaAction,
  eliminarCuentaAction,
} from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { formatMoney } from "@/components/casa-negocio/shared/format";
import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";
import { GRUPOS_CUENTA, TIPOS_CUENTA } from "@/features/casa-negocio/schemas";
import type { CuentaConfig, VistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

import { Campo, Editor, texto } from "./editor";
import { MetaInline } from "./meta";
import {
  GRUPO_LABEL,
  TIPO_LABEL,
  ahorroMarcadoPorDefecto,
  montoEntrada,
  saldoInicialTexto,
  tipoCuentaTexto,
  tonoCuenta,
} from "./texto";
import { useAccion } from "./use-accion";

type Edicion = { modo: "nueva" } | { modo: "editar"; cuenta: CuentaConfig } | null;

/** Day the module starts being used for real (spec: 1-dic-2026). */
const ARRANQUE = "2026-12-01";

/**
 * «Cuentas»: one card per account (canvas), the dashed «+ Cuenta» card, and
 * archived accounts behind a toggle. Each card shows its opening balance and
 * the day it was counted, which is what gets typed on 1-dic. Clicking a card
 * opens its editor when the viewer can configure; otherwise cards are plain,
 * read-only tiles. The savings goal sits in the heading once a savings
 * account is chosen («Poner una meta» in Ahorro leads here).
 */
export function Cuentas({
  cuentas,
  configuracion,
  puedeConfigurar,
  hoy,
}: {
  cuentas: CuentaConfig[];
  configuracion: VistaConfiguracion["configuracion"];
  puedeConfigurar: boolean;
  hoy: string;
}) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const activas = cuentas.filter((c) => !c.archivada);
  const archivadas = cuentas.filter((c) => c.archivada);

  return (
    <section aria-labelledby="cn-config-cuentas" className={r.section}>
      <div className={r.sectionHead}>
        <h2 id="cn-config-cuentas" className={r.sectionTitle}>
          Cuentas
        </h2>
        {/* The goal belongs to the savings account: offered once there is one. */}
        {configuracion.cuentaAhorroId ? (
          <MetaInline campo="metaAhorro" etiqueta="Meta de ahorro" configuracion={configuracion} puedeConfigurar={puedeConfigurar} />
        ) : null}
      </div>
      <div className={r.accounts}>
        {activas.map((c) => (
          <Tarjeta key={c.id} cuenta={c} puedeConfigurar={puedeConfigurar} onAbrir={() => setEdicion({ modo: "editar", cuenta: c })} />
        ))}
        {verArchivadas
          ? archivadas.map((c) => (
              <Tarjeta key={c.id} cuenta={c} puedeConfigurar={puedeConfigurar} onAbrir={() => setEdicion({ modo: "editar", cuenta: c })} />
            ))
          : null}
        {puedeConfigurar ? (
          <button type="button" className={r.addCard} onClick={() => setEdicion({ modo: "nueva" })}>
            + Cuenta
          </button>
        ) : activas.length === 0 ? (
          <p className={r.notice}>Todavía no hay cuentas.</p>
        ) : null}
      </div>
      {archivadas.length > 0 ? (
        <button type="button" className={r.archivedToggle} aria-expanded={verArchivadas} onClick={() => setVerArchivadas((v) => !v)}>
          {verArchivadas ? "Ocultar archivadas" : `Archivadas (${archivadas.length})`}
        </button>
      ) : null}

      {puedeConfigurar ? (
        <EditorCuenta
          key={edicion?.modo === "editar" ? `${edicion.cuenta.id}:${edicion.cuenta.version}` : edicion?.modo ?? "cerrado"}
          edicion={edicion}
          configuracion={configuracion}
          hoy={hoy}
          onCerrar={() => setEdicion(null)}
        />
      ) : null}
    </section>
  );
}

function Tarjeta({ cuenta, puedeConfigurar, onAbrir }: { cuenta: CuentaConfig; puedeConfigurar: boolean; onAbrir: () => void }) {
  const contenido = (
    <>
      <span aria-hidden="true" className={`${r.accountBar} ${r.accountBarTone[tonoCuenta(cuenta.grupo, cuenta.tipo)]}`} />
      <span className={r.accountName}>{cuenta.nombre}</span>
      <span className={r.accountType}>
        {tipoCuentaTexto(cuenta.grupo, cuenta.tipo)}
        {cuenta.archivada ? " · archivada" : ""}
      </span>
      <span className={r.accountOpening}>{saldoInicialTexto(cuenta.saldoInicial, cuenta.fechaSaldoInicial)}</span>
      {cuenta.esCuentaAhorro ? <span className={r.accountTag}>Cuenta de ahorro</span> : null}
    </>
  );
  const clase = `${r.account} ${cuenta.archivada ? r.accountArchived : ""}`;
  if (!puedeConfigurar) return <div className={clase}>{contenido}</div>;
  return (
    <button type="button" className={clase} onClick={onAbrir} aria-label={`Editar ${cuenta.nombre}`}>
      {contenido}
    </button>
  );
}

function EditorCuenta({
  edicion,
  configuracion,
  hoy,
  onCerrar,
}: {
  edicion: Edicion;
  configuracion: VistaConfiguracion["configuracion"];
  hoy: string;
  onCerrar: () => void;
}) {
  const guardar = useAccion();
  const archivar = useAccion();
  const borrar = useAccion();
  const cuenta = edicion?.modo === "editar" ? edicion.cuenta : null;
  const [grupo, setGrupo] = useState<(typeof GRUPOS_CUENTA)[number]>(cuenta?.grupo ?? "NEGOCIO");
  const [tipo, setTipo] = useState<(typeof TIPOS_CUENTA)[number]>(cuenta?.tipo ?? "EFECTIVO");
  const ocupado = guardar.pendiente || archivar.pendiente || borrar.pendiente;
  const error = guardar.error ?? archivar.error ?? borrar.error;
  const puedeSerAhorro = grupo === "CASA" && tipo === "AHORRO";
  const marcadoPorDefecto = ahorroMarcadoPorDefecto(cuenta, grupo, tipo, configuracion.cuentaAhorroId);

  const enviar = (datos: FormData) => {
    const comunes = {
      nombre: texto(datos, "nombre"),
      tipo,
      saldoInicial: texto(datos, "saldoInicial"),
      fechaSaldoInicial: texto(datos, "fechaSaldoInicial"),
      orden: String(cuenta?.orden ?? 0),
    };
    const quiereAhorro = puedeSerAhorro && datos.get("esAhorro") === "on";
    // The settings row as last read, for the follow-up that marks the savings account.
    const ajustes = {
      configVersion: configuracion.version,
      metaAsignacionCasa: montoEntrada(configuracion.metaAsignacionCasa),
      metaAhorro: montoEntrada(configuracion.metaAhorro),
    };
    guardar.ejecutar(async () => {
      if (!cuenta) return crearCuentaAction({ ...comunes, grupo, esAhorro: String(quiereAhorro), ...ajustes });
      const resultado = await editarCuentaAction({ ...comunes, cuentaId: cuenta.id, version: cuenta.version });
      if (!resultado.ok) return resultado;
      // Choosing (or un-choosing) the savings account edits the settings row.
      if (quiereAhorro === cuenta.esCuentaAhorro || cuenta.archivada) return resultado;
      return editarConfiguracionAction({
        version: configuracion.version,
        metaAsignacionCasa: montoEntrada(configuracion.metaAsignacionCasa),
        metaAhorro: montoEntrada(configuracion.metaAhorro),
        cuentaAhorroId: quiereAhorro ? cuenta.id : "",
      });
    }, onCerrar);
  };

  return (
    <Editor abierto={edicion !== null} titulo={cuenta ? cuenta.nombre : "Nueva cuenta"} error={error} onCerrar={onCerrar} onEnviar={enviar}>
      <div className={r.fields}>
        <Campo etiqueta="Nombre" error={guardar.campos.nombre} ancho>
          {(aria) => <input name="nombre" className={r.control} defaultValue={cuenta?.nombre ?? ""} maxLength={60} required {...aria} />}
        </Campo>
        <Campo etiqueta="Grupo" error={guardar.campos.grupo}>
          {(aria) => (
            <select
              name="grupo"
              className={r.control}
              value={grupo}
              disabled={cuenta !== null}
              onChange={(e) => {
                const g = e.target.value as typeof grupo;
                setGrupo(g);
                if (g === "NEGOCIO" && tipo === "AHORRO") setTipo("EFECTIVO");
              }}
              {...aria}
            >
              {GRUPOS_CUENTA.map((g) => (
                <option key={g} value={g}>
                  {GRUPO_LABEL[g]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Tipo" error={guardar.campos.tipo}>
          {(aria) => (
            <select name="tipo" className={r.control} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} {...aria}>
              {TIPOS_CUENTA.filter((t) => t !== "AHORRO" || grupo === "CASA").map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t].charAt(0).toUpperCase() + TIPO_LABEL[t].slice(1)}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Saldo inicial" error={guardar.campos.saldoInicial}>
          {(aria) => (
            <input
              name="saldoInicial"
              className={r.control}
              inputMode="decimal"
              defaultValue={cuenta ? montoEntrada(cuenta.saldoInicial) : ""}
              placeholder="0"
              {...aria}
            />
          )}
        </Campo>
        <Campo etiqueta="Fecha del saldo" error={guardar.campos.fechaSaldoInicial}>
          {(aria) => (
            <input
              name="fechaSaldoInicial"
              type="date"
              className={r.control}
              defaultValue={cuenta?.fechaSaldoInicial ?? (hoy < ARRANQUE ? ARRANQUE : hoy)}
              {...aria}
            />
          )}
        </Campo>
        {puedeSerAhorro && !cuenta?.archivada ? (
          <label className={`${r.check} ${r.fieldWide}`}>
            <input
              // Remount when the default flips (Casa·Ahorro chosen while creating).
              key={String(marcadoPorDefecto)}
              type="checkbox"
              name="esAhorro"
              className={r.checkBox}
              defaultChecked={marcadoPorDefecto}
            />
            Es la cuenta de ahorro
          </label>
        ) : null}
        {cuenta ? (
          <p className={`${r.hint} ${r.fieldWide}`}>Saldo hoy {formatMoney(cuenta.saldoActual)}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" tabIndex={-1} className={r.formError}>
          {error}
        </p>
      ) : null}

      <div className={r.footer}>
        <div className={r.footerSide}>
          {cuenta && !cuenta.tieneMovimientos && !cuenta.esCuentaAhorro ? (
            <button
              type="button"
              className={r.danger}
              disabled={ocupado}
              onClick={() => borrar.ejecutar(() => eliminarCuentaAction({ cuentaId: cuenta.id, version: cuenta.version }), onCerrar)}
            >
              Borrar
            </button>
          ) : null}
          {cuenta && (cuenta.tieneMovimientos || cuenta.archivada) ? (
            <button
              type="button"
              className={r.secondary}
              disabled={ocupado}
              onClick={() =>
                archivar.ejecutar(
                  () => archivarCuentaAction({ cuentaId: cuenta.id, version: cuenta.version, archivada: String(!cuenta.archivada) }),
                  onCerrar,
                )
              }
            >
              {cuenta.archivada ? "Restaurar" : "Archivar"}
            </button>
          ) : null}
        </div>
        <div className={r.footerSide}>
          <button type="button" className={r.secondary} onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className={r.primary} disabled={ocupado}>
            {guardar.pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Editor>
  );
}
