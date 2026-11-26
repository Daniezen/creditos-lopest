"use client";

import { useId, useMemo, useState, useTransition } from "react";

import { cnArqueoRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import { arquear, type ArqueoCuenta, type ResultadoArqueo } from "@/features/casa-negocio/domain";
import { diaCorto, leerContado, type ResultadoAccion, type VistaArqueo } from "@/server/casa-negocio/vista-arqueo";

import { CASA_NEGOCIO_HREF } from "../shell/rail-items";
import { EstadoTab } from "../ahorro/estado";
import { Notice } from "../shared/notice";
import { Glyph } from "../shared/glyph";

/** Result glyphs of the canvas: check, minus, plus, exclamation. */
const GLYPH: Record<ResultadoArqueo, string> = {
  CUADRA: "M5 12l5 5 9-10",
  FALTA: "M6 12h12",
  SOBRA: "M12 6v12M6 12h12",
  POR_CONTAR: "M12 8v5M12 16h.01",
};

export type GuardarArqueo = (input: {
  operationKey: string;
  conteos: { cuentaId: string; contado: string }[];
}) => Promise<ResultadoAccion<unknown>>;

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `arqueo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Arqueo tab (`Arqueo.dc.html`). «N de M cuadran» with one dot per account,
 * the cards grouped Negocio / Casa with «Lopest dice», «Contaste» and the
 * live result, the previous arqueos and «Guardar arqueo». Without
 * `casa_negocio.contar` there is no field at all: the card shows what Lopest
 * says and when it was last counted, so nothing looks editable.
 *
 * The result is recomputed on every keystroke with the domain engine
 * (`arquear`); only the accounts with something typed are sent, and the
 * server recomputes «Lopest dice» itself when saving.
 *
 * The operation key is generated once per arqueo being typed and renewed
 * after a successful save, so a double click saves one arqueo.
 */
export function ArqueoView({ vista, guardar }: { vista: VistaArqueo; guardar?: GuardarArqueo }) {
  const [contado, setContado] = useState<Record<string, string>>({});
  const [clave, setClave] = useState(nuevaClave);
  const [resultado, setResultado] = useState<ResultadoAccion<unknown> | null>(null);
  const [pendiente, startTransition] = useTransition();
  const mensajeId = useId();

  const cuentas = useMemo(() => vista.grupos.flatMap((g) => g.cuentas), [vista.grupos]);
  const global = useMemo(
    () =>
      arquear(
        cuentas.map((c) => ({
          cuentaId: c.cuentaId,
          nombre: c.nombre,
          ambito: c.grupo,
          saldoSistema: c.saldoSistema,
          contado: leerContado(contado[c.cuentaId] ?? ""),
        })),
      ),
    [cuentas, contado],
  );
  const porCuenta = new Map<string, ArqueoCuenta>(global.cuentas.map((c) => [c.cuentaId, c]));

  if (vista.totalCuentas === 0) {
    return (
      <EstadoTab
        titulo="No hay cuentas para contar"
        texto={vista.puedeConfigurar ? "Crea las cuentas del negocio y de la casa en Configuración." : "Quien configura el módulo debe crear las cuentas."}
        accion={vista.puedeConfigurar ? { label: "Ir a Configuración", href: `${CASA_NEGOCIO_HREF}/configuracion` } : undefined}
      />
    );
  }

  const contadas = global.cuentas.filter((c) => c.resultado !== "POR_CONTAR");
  const puedeGuardar = vista.puedeContar && Boolean(guardar) && contadas.length > 0 && !pendiente;

  const onGuardar = () => {
    if (!guardar || contadas.length === 0) return;
    setResultado(null);
    startTransition(async () => {
      const r = await guardar({
        operationKey: clave,
        conteos: contadas.map((c) => ({ cuentaId: c.cuentaId, contado: String(c.contado) })),
      });
      setResultado(r);
      if (r.ok) {
        setContado({});
        setClave(nuevaClave());
      }
    });
  };

  return (
    <>
      {/* Live tally only for whoever counts: a viewer would read a false «0 de 5 cuadran». */}
      {vista.puedeContar ? (
        <div className={cnArqueoRecipes.summary}>
          <div className={cnArqueoRecipes.summaryFigure} role="status" aria-live="polite" aria-atomic="true">
            <span className={cnArqueoRecipes.summaryCount}>
              {global.cuadran} de {global.total}
            </span>
            <span className={cnArqueoRecipes.summaryLabel}>{global.cuadran === 1 ? "cuadra" : "cuadran"}</span>
          </div>
          <div className={cnArqueoRecipes.dots} aria-hidden="true">
            {global.cuentas.map((c) => (
              <span key={c.cuentaId} className={`${cnArqueoRecipes.dot} ${cnArqueoRecipes.dotTone[c.resultado]}`} />
            ))}
          </div>
        </div>
      ) : null}

      {vista.avisos.length > 0 ? (
        <div className={cnArqueoRecipes.notices}>
          {vista.avisos.map((a) => (
            <Notice key={`${a.elemento}-${a.texto}`} level={a.nivel}>
              {a.texto}
            </Notice>
          ))}
        </div>
      ) : null}

      <div className={cnArqueoRecipes.groups}>
        {vista.grupos.map((g) => (
          <div key={g.grupo} className={g.grupo === "NEGOCIO" ? cnArqueoRecipes.groupNegocio : cnArqueoRecipes.groupCasa}>
            <h2 className={`${cnArqueoRecipes.groupLabel} ${cnArqueoRecipes.groupTone[g.grupo]}`}>
              <span
                aria-hidden="true"
                className={`${cnArqueoRecipes.groupSwatch} ${cnArqueoRecipes.groupSwatchTone[g.grupo]}`}
              />
              {g.etiqueta}
            </h2>
            <div className={cnArqueoRecipes.grid}>
              {g.cuentas.map((c) => {
                const r = porCuenta.get(c.cuentaId);
                const estado = r?.resultado ?? "POR_CONTAR";
                const inputId = `contado-${c.cuentaId}`;
                const resultadoId = `resultado-${c.cuentaId}`;
                const escrito = contado[c.cuentaId] ?? "";
                // Something typed that is not an amount: say so instead of «Por contar».
                const ilegible = escrito.trim() !== "" && leerContado(escrito) === null;
                return (
                  <section key={c.cuentaId} aria-label={c.nombre} className={`${cnArqueoRecipes.card} ${cnArqueoRecipes.cardTone[estado]}`}>
                    <span className={cnArqueoRecipes.cardName}>{c.nombre}</span>
                    <div>
                      <div className={cnArqueoRecipes.cardLabel}>Lopest dice</div>
                      <div className={cnArqueoRecipes.cardSystem}>{c.saldoTexto}</div>
                    </div>
                    {vista.puedeContar ? (
                      <>
                        <label htmlFor={inputId} className={cnArqueoRecipes.field}>
                          Contaste
                          <input
                            id={inputId}
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="$ 0"
                            value={escrito}
                            onChange={(e) => setContado((prev) => ({ ...prev, [c.cuentaId]: e.target.value }))}
                            disabled={pendiente}
                            aria-invalid={ilegible || undefined}
                            aria-describedby={resultadoId}
                            className={cnArqueoRecipes.input}
                          />
                        </label>
                        <div id={resultadoId} className={cnArqueoRecipes.result}>
                          <span className={`${cnArqueoRecipes.resultIcon} ${cnArqueoRecipes.resultIconTone[estado]}`} aria-hidden="true">
                            <Glyph path={GLYPH[estado]} className={cnArqueoRecipes.resultGlyph} strokeWidth={3} />
                          </span>
                          <span className={`${cnArqueoRecipes.resultText} ${cnArqueoRecipes.resultTextTone[estado]}`}>
                            {ilegible ? "No se entiende el número" : (r?.texto ?? "Por contar")}
                          </span>
                        </div>
                      </>
                    ) : null}
                    <span className={cnArqueoRecipes.lastCount}>
                      {c.ultimoConteo ? `Contada el ${diaCorto(c.ultimoConteo)}` : "Nunca contada"}
                    </span>
                  </section>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={cnArqueoRecipes.footer}>
        {vista.historial.length > 0 ? (
          <ul className={cnArqueoRecipes.history} aria-label="Arqueos anteriores">
            <li className={cnArqueoRecipes.historyLabel} aria-hidden="true">
              Antes:
            </li>
            {vista.historial.map((h) => (
              <li key={h.id} className={`${cnArqueoRecipes.historyChip} ${cnArqueoRecipes.historyTone[h.tono]}`}>
                {h.texto}
              </li>
            ))}
          </ul>
        ) : (
          <p className={cnArqueoRecipes.history}>Todavía no hay arqueos guardados.</p>
        )}
        {vista.puedeContar ? (
          <div className={cnArqueoRecipes.saveRow}>
            <button
              type="button"
              className={cnArqueoRecipes.save}
              onClick={onGuardar}
              disabled={!puedeGuardar}
              aria-describedby={resultado ? mensajeId : undefined}
            >
              {pendiente ? "Guardando…" : "Guardar arqueo"}
            </button>
            <div aria-live="polite">
              {resultado ? (
                <p id={mensajeId} role={resultado.ok ? "status" : "alert"} className={resultado.ok ? cnArqueoRecipes.saveMessage : cnArqueoRecipes.saveError}>
                  {resultado.mensaje}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
