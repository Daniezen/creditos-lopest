"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";

import { cnAhorroRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import { NOMBRES_MES, pesos } from "@/features/casa-negocio/domain";
import type { CierreVista } from "@/server/casa-negocio/vista-ahorro";
import type { ResultadoAccion } from "@/server/casa-negocio/vista-arqueo";

import { Glyph } from "../shared/glyph";
import { CASA_NEGOCIO_HREF } from "../shell/rail-items";

const ARROW = "M5 12h14M13 6l6 6-6 6";

/** «631.000» → the editable amount of the confirmation step. */
function montoEditable(monto: number): string {
  return Math.round(monto).toLocaleString("es-CO");
}

export interface CierreCardProps {
  cierre: CierreVista;
  /** Name of the savings account («Nu · ahorro»). */
  destino: string;
  /** Server action; absent in previews, which disables the button. */
  pasar?: (input: { mes: string; cuentaOrigenId: string; monto: string }) => Promise<ResultadoAccion<unknown>>;
}

/**
 * Dark «Cierre de …» card (`Ahorro.dc.html`, right): what is left of the
 * house this month, the route Cuenta casa → savings, and «Pasar al ahorro».
 *
 * The button never moves money on the first press: it opens a confirmation
 * with the amount (editable, in case less should go) and only «Confirmar»
 * calls the server. The server decides the once-per-month key, so pressing
 * twice, or two people at once, still moves it a single time.
 */
export function CierreCard({ cierre, destino, pasar }: CierreCardProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [origenId, setOrigenId] = useState(cierre.origenId ?? "");
  const [monto, setMonto] = useState(montoEditable(cierre.propuesto));
  const [resultado, setResultado] = useState<ResultadoAccion<unknown> | null>(null);
  const [pendiente, startTransition] = useTransition();
  const ids = { titulo: useId(), monto: useId(), origen: useId(), mensaje: useId() };
  // Focus targets: the opener gets focus back when the confirmation closes
  // (cancel or failure-free submit removes the form the focus was in), and a
  // success message takes it so it is read even if the button disappeared.
  const abrirRef = useRef<HTMLButtonElement>(null);
  const mensajeRef = useRef<HTMLParagraphElement>(null);
  // Set by the handlers, consumed after the next commit (when the target exists).
  const focoPendiente = useRef<"abrir" | "mensaje" | null>(null);
  useEffect(() => {
    const destino = focoPendiente.current;
    focoPendiente.current = null;
    if (destino === "abrir") abrirRef.current?.focus();
    if (destino === "mensaje") mensajeRef.current?.focus();
  }, [confirmando, resultado]);

  const origen = cierre.origenes.find((o) => o.id === origenId) ?? null;
  const figura = cierre.estado === "HECHO" && cierre.hecho ? cierre.hecho.monto : cierre.estado === "FUTURO" ? null : cierre.sobrante;

  const confirmar = () => {
    if (!pasar || !origenId) return;
    setResultado(null);
    startTransition(async () => {
      const r = await pasar({ mes: cierre.mes, cuentaOrigenId: origenId, monto });
      setResultado(r);
      if (r.ok) {
        setConfirmando(false);
        focoPendiente.current = "mensaje";
      }
    });
  };

  const ruta = (
    <div className={cnAhorroRecipes.closingRoute}>
      {cierre.origenes.length > 1 && cierre.estado === "PENDIENTE" && cierre.puedePasar ? (
        <>
          <label htmlFor={ids.origen} className="sr-only">
            Cuenta de la casa de donde sale
          </label>
          <select
            id={ids.origen}
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
            className={cnAhorroRecipes.closingSelect}
            disabled={pendiente}
          >
            {cierre.origenes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span>{origen?.nombre ?? cierre.origenes[0]?.nombre ?? "Cuenta casa"}</span>
      )}
      <Glyph path={ARROW} className={cnAhorroRecipes.closingArrow} strokeWidth={2} />
      <span>{destino}</span>
    </div>
  );

  return (
    <section aria-labelledby={ids.titulo} className={cnAhorroRecipes.closing}>
      <div>
        <h2 id={ids.titulo} className={cnAhorroRecipes.closingEyebrow}>
          {cierre.titulo}
        </h2>
        <div className={cnAhorroRecipes.closingFigure}>{figura === null ? "—" : pesos(figura)}</div>
        {cierre.estado === "SIN_ORIGEN" ? null : ruta}
      </div>

      {cierre.estado === "HECHO" && cierre.hecho ? (
        <p className={cnAhorroRecipes.closingDone}>En el ahorro · {cierre.hecho.fecha.slice(8, 10).replace(/^0/, "")} de {nombreDelMes(cierre.hecho.fecha)}</p>
      ) : null}
      {cierre.estado === "NADA" ? <p className={cnAhorroRecipes.closingDone}>No sobró nada para pasar</p> : null}
      {cierre.estado === "FUTURO" ? <p className={cnAhorroRecipes.closingDone}>El mes todavía no empieza</p> : null}
      {cierre.estado === "SIN_ORIGEN" ? (
        <p className={cnAhorroRecipes.closingDone}>
          Falta una cuenta de la casa de donde sacarlo.{" "}
          <Link href={`${CASA_NEGOCIO_HREF}/configuracion`} className="text-current underline underline-offset-2">
            Configuración
          </Link>
        </p>
      ) : null}

      {cierre.estado === "PENDIENTE" && cierre.puedePasar ? (
        confirmando ? (
          <form
            className={cnAhorroRecipes.confirm}
            onSubmit={(e) => {
              e.preventDefault();
              confirmar();
            }}
          >
            <label htmlFor={ids.monto} className={cnAhorroRecipes.confirmLabel}>
              Monto a pasar
              <input
                id={ids.monto}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={cnAhorroRecipes.confirmInput}
                aria-describedby={resultado && !resultado.ok ? ids.mensaje : undefined}
                aria-invalid={resultado && !resultado.ok && resultado.campo === "monto" ? true : undefined}
                disabled={pendiente}
                autoFocus
              />
            </label>
            <div className={cnAhorroRecipes.confirmActions}>
              <button type="submit" className={cnAhorroRecipes.closingButton} disabled={pendiente || !pasar}>
                {pendiente ? "Pasando…" : "Confirmar"}
              </button>
              <button
                type="button"
                className={cnAhorroRecipes.confirmCancel}
                onClick={() => {
                  setConfirmando(false);
                  setResultado(null);
                  setMonto(montoEditable(cierre.propuesto));
                  focoPendiente.current = "abrir";
                }}
                disabled={pendiente}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            ref={abrirRef}
            type="button"
            className={cnAhorroRecipes.closingButton}
            onClick={() => setConfirmando(true)}
            disabled={!pasar}
          >
            Pasar al ahorro
          </button>
        )
      ) : null}

      <div aria-live="polite">
        {resultado ? (
          <p
            ref={mensajeRef}
            id={ids.mensaje}
            tabIndex={-1}
            role={resultado.ok ? "status" : "alert"}
            className={resultado.ok ? cnAhorroRecipes.message : cnAhorroRecipes.messageError}>
            {resultado.mensaje}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function nombreDelMes(dia: string): string {
  return NOMBRES_MES[Number(dia.slice(5, 7)) - 1] ?? "";
}
