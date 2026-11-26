import { cnCardRecipes, cnNegocioRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { CuentaOpcion } from "@/server/casa-negocio/vista-casa";
import type { PendienteAsignar, VistaNegocio } from "@/server/casa-negocio/vista-negocio";

import { formatMoney } from "../shared/format";
import { SelectorCuenta } from "./selector-cuenta";

function fechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Cobros and disbursements of OTHER months still without account (those of
 * the month being looked at carry their picker inside the book). One row
 * each, the picker inline, so a run of them is assigned one after another.
 */
export function SinCuenta({
  pendientes,
  cuentas,
  sugerida,
}: {
  pendientes: PendienteAsignar[];
  cuentas: CuentaOpcion[];
  sugerida: VistaNegocio["sugerida"];
}) {
  if (pendientes.length === 0) return null;
  return (
    <section aria-labelledby="sin-cuenta" className={cnNegocioRecipes.pending}>
      <h2 id="sin-cuenta" className={cnCardRecipes.titleSm}>
        Sin cuenta de otros meses · {pendientes.length}
      </h2>
      <ul>
        {pendientes.map((p) => (
          <li key={p.key} className={cnNegocioRecipes.pendingRow}>
            <div className={cnNegocioRecipes.pendingBody}>
              <div className={cnNegocioRecipes.moveName}>
                {p.tipo}
                {p.dueno ? <span className={cnNegocioRecipes.owner}>{p.dueno}</span> : null}
              </div>
              <div className={cnNegocioRecipes.moveSub}>
                {fechaCorta(p.fecha)} · {p.detalle}
              </div>
            </div>
            <span className={`${cnNegocioRecipes.pendingAmount} ${p.signo > 0 ? cnNegocioRecipes.effectIn : cnNegocioRecipes.effectOut}`}>
              {p.signo > 0 ? "+" : ""}
              {formatMoney(p.signo * p.monto)}
            </span>
            <SelectorCuenta
              asignacion={p.asignacion}
              fecha={p.fecha}
              cuentas={cuentas}
              sugerida={p.signo > 0 ? sugerida.cobro : sugerida.desembolso}
              contexto={`${p.tipo} · ${p.detalle}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
