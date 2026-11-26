"use client";

import { useState } from "react";

import { cnCardRecipes, cnNegocioRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { CuentaOpcion } from "@/server/casa-negocio/vista-casa";
import { TODAS, type FiltroCuenta, type FilaNegocio, type VistaNegocio } from "@/server/casa-negocio/vista-negocio";

import { EditarMovimiento, type OpcionesEdicion } from "../casa/editar-movimiento";
import { formatMoney } from "../shared/format";
import { Glyph } from "../shared/glyph";
import { SelectorCuenta } from "./selector-cuenta";

const PENCIL = "M4 20h4L19 9l-4-4L4 16z";

const TONO_SUB: Record<FiltroCuenta["tono"], string> = {
  neutral: cnNegocioRecipes.filterSub,
  ok: cnNegocioRecipes.filterSub,
  atencion: cnNegocioRecipes.filterSubProblem,
  problema: cnNegocioRecipes.filterSubProblem,
};

export interface LibroCajaProps {
  filtros: FiltroCuenta[];
  libro: FilaNegocio[];
  nombreMes: string;
  cuentasNegocio: CuentaOpcion[];
  sugerida: VistaNegocio["sugerida"];
  /** Null in read-only mode: no pickers, no edit buttons. */
  edicion: OpcionesEdicion | null;
  /** Drawn between the filters and the book (the «Anotar» form, the pending list). */
  children?: React.ReactNode;
}

/** Shown amount of a row under the current filter, with its sign and colour. */
function efecto(fila: FilaNegocio, filtro: string): { texto: string; clase: string } {
  const n = filtro === TODAS ? fila.efecto : (fila.efectoPorCuenta[filtro] ?? 0);
  if (n === 0) return { texto: formatMoney(fila.montoNeutral ?? Math.abs(fila.efecto)), clase: cnNegocioRecipes.effectNeutral };
  return { texto: `${n > 0 ? "+" : ""}${formatMoney(n)}`, clase: n > 0 ? cnNegocioRecipes.effectIn : cnNegocioRecipes.effectOut };
}

function saldo(fila: FilaNegocio, filtro: string): string {
  const s = filtro === TODAS ? fila.saldo : fila.saldoPorCuenta[filtro];
  return s === null || s === undefined ? "" : formatMoney(s);
}

function Marca({ fila }: { fila: FilaNegocio }) {
  return fila.origen === "auto" ? (
    <span title="Lo trae Lopest desde Créditos" className={cnNegocioRecipes.badgeAuto}>
      L<span className="sr-only">, automático desde Créditos</span>
    </span>
  ) : (
    <span className={cnNegocioRecipes.badgeManual}>
      <Glyph path={PENCIL} className="size-3" strokeWidth={2.4} />
      <span className="sr-only">Anotado a mano</span>
    </span>
  );
}

function Movimiento({ fila }: { fila: FilaNegocio }) {
  return (
    <div className={cnNegocioRecipes.move}>
      <Marca fila={fila} />
      <div className="min-w-0">
        <div className={cnNegocioRecipes.moveName}>
          {fila.tipo}
          {fila.dueno ? <span className={cnNegocioRecipes.owner}>{fila.dueno}</span> : null}
        </div>
        <div className={cnNegocioRecipes.moveSub}>{fila.detalle}</div>
      </div>
    </div>
  );
}

/**
 * Accounts as filters (one pressed at a time) and the cash book under them:
 * a table on wide screens, cards on the phone. The filter is client state;
 * every balance it can show was precomputed by the view model.
 */
export function LibroCaja({ filtros, libro, nombreMes, cuentasNegocio, sugerida, edicion, children }: LibroCajaProps) {
  const [filtro, setFiltro] = useState(TODAS);
  const filas = filtro === TODAS ? libro : libro.filter((f) => f.cuentas.includes(filtro));

  const cuenta = (fila: FilaNegocio) =>
    fila.asignacion && edicion ? (
      <SelectorCuenta
        asignacion={fila.asignacion}
        fecha={fila.fecha}
        cuentas={cuentasNegocio}
        sugerida={fila.asignacion.clase === "cobro" ? sugerida.cobro : sugerida.desembolso}
        contexto={`${fila.tipo} · ${fila.detalle}`}
      />
    ) : (
      fila.cuentaTexto
    );
  const editar = (fila: FilaNegocio) =>
    edicion && fila.editable ? <EditarMovimiento movimiento={fila.editable} nombre={fila.tipo.toLowerCase()} opciones={edicion} /> : null;

  return (
    <>
      <div role="group" aria-label="Cuentas del negocio" className={cnNegocioRecipes.filters}>
        {filtros.map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} className={cnNegocioRecipes.filter} onClick={() => setFiltro(f.id)}>
            <span className={cnNegocioRecipes.filterName}>{f.nombre}</span>
            <span className={cnNegocioRecipes.filterBalance}>{formatMoney(f.saldo)}</span>
            <span className={TONO_SUB[f.tono]}>{f.detalle}</span>
          </button>
        ))}
      </div>

      {children}

      {filas.length === 0 ? (
        <p className={cnCardRecipes.empty}>Sin movimientos del negocio en {nombreMes}.</p>
      ) : (
        <>
          <section aria-label="Libro de caja" className={cnNegocioRecipes.book}>
            <table className={cnNegocioRecipes.table}>
              <thead>
                <tr>
                  <th scope="col" className={cnNegocioRecipes.th}>Día</th>
                  <th scope="col" className={cnNegocioRecipes.th}>Movimiento</th>
                  <th scope="col" className={cnNegocioRecipes.th}>Cuenta</th>
                  <th scope="col" className={cnNegocioRecipes.thNum}>Capital</th>
                  <th scope="col" className={cnNegocioRecipes.thNum}>Interés</th>
                  <th scope="col" className={cnNegocioRecipes.thNum}>Entra / sale</th>
                  <th scope="col" className={cnNegocioRecipes.thNum}>Saldo</th>
                  {edicion ? (
                    <th scope="col" className={cnNegocioRecipes.th}>
                      <span className="sr-only">Editar</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const ef = efecto(f, filtro);
                  return (
                    <tr key={f.key} className={cnNegocioRecipes.tr}>
                      <td className={cnNegocioRecipes.tdDay}>{f.dia}</td>
                      <td className={cnNegocioRecipes.td}>
                        <Movimiento fila={f} />
                      </td>
                      <td className={cnNegocioRecipes.tdMuted}>{cuenta(f)}</td>
                      <td className={cnNegocioRecipes.tdNum}>{f.capital ? formatMoney(f.capital) : ""}</td>
                      <td className={cnNegocioRecipes.tdNum}>{f.interes ? formatMoney(f.interes) : ""}</td>
                      <td className={`${cnNegocioRecipes.tdEffect} ${ef.clase}`}>{ef.texto}</td>
                      <td className={cnNegocioRecipes.tdBalance}>{saldo(f, filtro)}</td>
                      {edicion ? <td className={cnNegocioRecipes.td}>{editar(f)}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <ul aria-label="Libro de caja" className={cnNegocioRecipes.cards}>
            {filas.map((f) => {
              const ef = efecto(f, filtro);
              const s = saldo(f, filtro);
              return (
                <li key={f.key} className={cnNegocioRecipes.card}>
                  <div className={cnNegocioRecipes.cardTop}>
                    <span className={cnNegocioRecipes.cardDay}>{f.dia}</span>
                    <div className={cnNegocioRecipes.cardBody}>
                      <Movimiento fila={f} />
                    </div>
                    <span className={`${cnNegocioRecipes.pendingAmount} ${ef.clase}`}>{ef.texto}</span>
                    {editar(f)}
                  </div>
                  <div className={cnNegocioRecipes.cardFoot}>
                    <span>{cuenta(f)}</span>
                    {s ? <span>Saldo {s}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
