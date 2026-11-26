"use client";

import { useOptimistic, useState } from "react";

import { crearGastoAction, editarGastoAction } from "@/app/(casa-negocio)/casa-negocio/configuracion/actions";
import { formatMoney } from "@/components/casa-negocio/shared/format";
import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";
import type { ClaseGasto } from "@/features/casa-negocio/types";
import type { GastoConfig, VistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

import { Campo, Editor, texto } from "./editor";
import { MetaInline } from "./meta";
import { MESES, montoEntrada, subtituloGasto } from "./texto";
import { useAccion } from "./use-accion";

type Edicion = { modo: "nuevo"; clase: ClaseGasto } | { modo: "editar"; gasto: GastoConfig } | null;

const COLUMNAS: ReadonlyArray<{ clase: ClaseGasto; titulo: string; unidad: [string, string] }> = [
  { clase: "FIJO", titulo: "Fijos · con fecha", unidad: ["gasto", "gastos"] },
  { clase: "VARIABLE", titulo: "Variables · con tope", unidad: ["sobre", "sobres"] },
];

/** Edit payload of a category, every field as the schema expects it (strings). */
function payload(g: GastoConfig, cambios: Partial<Record<string, string>> = {}) {
  return {
    categoriaId: g.id,
    version: g.version,
    nombre: g.nombre,
    clase: g.clase,
    monto: montoEntrada(g.monto),
    periodicidad: g.periodicidad,
    mesAnual: g.mesAnual ? String(g.mesAnual) : "",
    diaPago: g.diaPago ? String(g.diaPago) : "",
    activa: String(g.activa),
    orden: String(g.orden),
    ...cambios,
  };
}

/**
 * «Gastos de la casa»: the monthly goal inline, then the two columns of the
 * canvas. The arrow moves an expense to the other column; the server re-files
 * its movements under the new class in the same transaction, so nothing is
 * lost. A variable is always monthly, so an annual fixed expense becomes
 * monthly when it moves.
 */
export function Gastos({
  gastos,
  configuracion,
  puedeConfigurar,
}: {
  gastos: GastoConfig[];
  configuracion: VistaConfiguracion["configuracion"];
  puedeConfigurar: boolean;
}) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const mover = useAccion();
  const [vista, moverOptimista] = useOptimistic(gastos, (actual, { id, clase }: { id: string; clase: ClaseGasto }) =>
    actual.map((g) => (g.id === id ? { ...g, clase, periodicidad: clase === "VARIABLE" ? ("MENSUAL" as const) : g.periodicidad } : g)),
  );

  const alMover = (g: GastoConfig) => {
    const clase: ClaseGasto = g.clase === "FIJO" ? "VARIABLE" : "FIJO";
    mover.ejecutar(async () => {
      moverOptimista({ id: g.id, clase });
      return editarGastoAction(payload(g, { clase, ...(clase === "VARIABLE" ? { periodicidad: "MENSUAL", mesAnual: "" } : {}) }));
    });
  };

  return (
    <section aria-labelledby="cn-config-gastos" className={r.section}>
      <div className={r.sectionHead}>
        <h2 id="cn-config-gastos" className={r.sectionTitle}>
          Gastos de la casa
        </h2>
        <MetaInline campo="metaAsignacionCasa" etiqueta="Meta mensual para la casa" configuracion={configuracion} puedeConfigurar={puedeConfigurar} />
      </div>
      {mover.error ? (
        <p role="alert" tabIndex={-1} className={r.formError}>
          {mover.error}
        </p>
      ) : null}
      <div className={r.columns}>
        {COLUMNAS.map((col) => {
          const items = vista.filter((g) => g.clase === col.clase);
          return (
            <div key={col.clase} className={`${r.column} ${r.columnTone[col.clase]}`}>
              <div className={r.columnHead}>
                <span className={`${r.columnTitle} ${r.columnTitleTone[col.clase]}`}>{col.titulo}</span>
                <span className={r.columnTotal}>
                  {items.length} {items.length === 1 ? col.unidad[0] : col.unidad[1]}
                </span>
              </div>
              {items.length === 0 ? <p className={r.columnEmpty}>Sin {col.unidad[1]} todavía.</p> : null}
              {items.map((g) => (
                <Fila
                  key={g.id}
                  gasto={g}
                  puedeConfigurar={puedeConfigurar}
                  moviendo={mover.pendiente}
                  onAbrir={() => setEdicion({ modo: "editar", gasto: g })}
                  onMover={() => alMover(g)}
                />
              ))}
              {puedeConfigurar ? (
                <button type="button" className={r.columnAdd} onClick={() => setEdicion({ modo: "nuevo", clase: col.clase })}>
                  + {col.clase === "FIJO" ? "Gasto fijo" : "Sobre"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {puedeConfigurar ? (
        <EditorGasto
          key={edicion?.modo === "editar" ? `${edicion.gasto.id}:${edicion.gasto.version}` : edicion ? `nuevo:${edicion.clase}` : "cerrado"}
          edicion={edicion}
          onCerrar={() => setEdicion(null)}
        />
      ) : null}
    </section>
  );
}

function Fila({
  gasto,
  puedeConfigurar,
  moviendo,
  onAbrir,
  onMover,
}: {
  gasto: GastoConfig;
  puedeConfigurar: boolean;
  moviendo: boolean;
  onAbrir: () => void;
  onMover: () => void;
}) {
  const esFijo = gasto.clase === "FIJO";
  const sub = subtituloGasto(gasto);
  const moverLabel = `Pasar ${gasto.nombre} a ${esFijo ? "variables" : "fijos"}`;
  return (
    <div className={`${r.expense} ${gasto.activa ? "" : r.expenseInactive}`}>
      <button type="button" className={r.expenseBody} disabled={!puedeConfigurar} onClick={onAbrir} aria-label={puedeConfigurar ? `Editar ${gasto.nombre}` : undefined}>
        <span className={r.expenseName}>{gasto.nombre}</span>
        <span className={r.expenseSub}>{sub.texto}</span>
      </button>
      <span className={r.expenseAmount}>{gasto.monto === null ? "—" : formatMoney(gasto.monto)}</span>
      {puedeConfigurar ? (
        <button type="button" className={r.move} onClick={onMover} disabled={moviendo} aria-label={moverLabel} title={moverLabel}>
          <span aria-hidden="true">{esFijo ? "→" : "←"}</span>
        </button>
      ) : null}
    </div>
  );
}

function EditorGasto({ edicion, onCerrar }: { edicion: Edicion; onCerrar: () => void }) {
  const accion = useAccion();
  const gasto = edicion?.modo === "editar" ? edicion.gasto : null;
  const [clase, setClase] = useState<ClaseGasto>(gasto?.clase ?? (edicion?.modo === "nuevo" ? edicion.clase : "FIJO"));
  const [periodicidad, setPeriodicidad] = useState(gasto?.periodicidad ?? "MENSUAL");
  const anual = clase === "FIJO" && periodicidad === "ANUAL";

  const enviar = (datos: FormData) => {
    const campos = {
      nombre: texto(datos, "nombre"),
      clase,
      monto: texto(datos, "monto"),
      periodicidad: clase === "VARIABLE" ? "MENSUAL" : periodicidad,
      mesAnual: anual ? texto(datos, "mesAnual") : "",
      diaPago: texto(datos, "diaPago"),
      activa: String(datos.get("activa") === "on"),
      orden: String(gasto?.orden ?? 0),
    };
    accion.ejecutar(
      () => (gasto ? editarGastoAction({ ...campos, categoriaId: gasto.id, version: gasto.version }) : crearGastoAction(campos)),
      onCerrar,
    );
  };

  return (
    <Editor
      abierto={edicion !== null}
      error={accion.error}
      titulo={gasto ? gasto.nombre : clase === "FIJO" ? "Nuevo gasto fijo" : "Nuevo sobre"}
      onCerrar={onCerrar}
      onEnviar={enviar}
    >
      <div className={r.fields}>
        <Campo etiqueta="Nombre" error={accion.campos.nombre} ancho>
          {(aria) => <input name="nombre" className={r.control} defaultValue={gasto?.nombre ?? ""} maxLength={60} {...aria} />}
        </Campo>
        <Campo etiqueta="Clase" error={accion.campos.clase}>
          {(aria) => (
            <select name="clase" className={r.control} value={clase} onChange={(e) => setClase(e.target.value as ClaseGasto)} {...aria}>
              <option value="FIJO">Fijo · con fecha</option>
              <option value="VARIABLE">Variable · con tope</option>
            </select>
          )}
        </Campo>
        <Campo etiqueta={clase === "FIJO" ? "Monto" : "Tope mensual"} error={accion.campos.monto}>
          {(aria) => (
            <input name="monto" className={r.control} inputMode="decimal" defaultValue={montoEntrada(gasto?.monto ?? null)} placeholder="Sin monto" {...aria} />
          )}
        </Campo>
        {clase === "FIJO" ? (
          <Campo etiqueta="Cada cuánto" error={accion.campos.periodicidad}>
            {(aria) => (
              <select
                name="periodicidad"
                className={r.control}
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value as typeof periodicidad)}
                {...aria}
              >
                <option value="MENSUAL">Cada mes</option>
                <option value="ANUAL">Cada año</option>
              </select>
            )}
          </Campo>
        ) : null}
        {anual ? (
          <Campo etiqueta="Mes" error={accion.campos.mesAnual}>
            {(aria) => (
              <select name="mesAnual" className={r.control} defaultValue={gasto?.mesAnual ? String(gasto.mesAnual) : ""} {...aria}>
                <option value="">Elige el mes</option>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        ) : null}
        <Campo etiqueta="Día de pago" error={accion.campos.diaPago}>
          {(aria) => (
            <input
              name="diaPago"
              className={r.control}
              inputMode="numeric"
              defaultValue={gasto?.diaPago ? String(gasto.diaPago) : ""}
              placeholder="1 a 31"
              {...aria}
            />
          )}
        </Campo>
        <label className={`${r.check} ${r.fieldWide}`}>
          <input type="checkbox" name="activa" className={r.checkBox} defaultChecked={gasto?.activa ?? true} />
          Activo
        </label>
        {gasto && gasto.movimientos > 0 ? (
          <p className={`${r.hint} ${r.fieldWide}`}>
            {gasto.movimientos} {gasto.movimientos === 1 ? "movimiento" : "movimientos"}; se conservan si cambia de clase.
          </p>
        ) : null}
      </div>
      {accion.error ? (
        <p role="alert" tabIndex={-1} className={r.formError}>
          {accion.error}
        </p>
      ) : null}
      <div className={r.footer}>
        <span />
        <div className={r.footerSide}>
          <button type="button" className={r.secondary} onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className={r.primary} disabled={accion.pendiente}>
            {accion.pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Editor>
  );
}
