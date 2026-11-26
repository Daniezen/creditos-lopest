import { cnAhorroRecipes, cnArqueoRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import type { VistaAhorro } from "@/server/casa-negocio/vista-ahorro";

import { Notice } from "../shared/notice";
import { CASA_NEGOCIO_HREF } from "../shell/rail-items";
import { CierreCard, type CierreCardProps } from "./cierre-card";
import { DepositsChart } from "./deposits-chart";
import { EstadoTab } from "./estado";
import { GoalRing } from "./goal-ring";

/**
 * Ahorro tab content (`Ahorro.dc.html`): goal ring and the dark cierre card
 * side by side (stacked on phones, ring first), then the deposits by month.
 * Without a savings account chosen in Configuración, an empty state that
 * leads there.
 */
export function AhorroView({ vista, pasar }: { vista: VistaAhorro; pasar?: CierreCardProps["pasar"] }) {
  if (vista.estado === "SIN_CUENTA") {
    return (
      <EstadoTab
        titulo="Falta la cuenta de ahorro"
        texto={
          vista.puedeConfigurar
            ? "Elige en Configuración cuál cuenta de la casa guarda el ahorro."
            : "Quien configura el módulo debe elegir la cuenta de ahorro."
        }
        accion={vista.puedeConfigurar ? { label: "Ir a Configuración", href: `${CASA_NEGOCIO_HREF}/configuracion` } : undefined}
      />
    );
  }

  return (
    <>
      {vista.avisos.length > 0 ? (
        <div className={cnArqueoRecipes.notices}>
          {vista.avisos.map((a) => (
            <Notice key={a.elemento} level={a.nivel}>
              {a.texto}
            </Notice>
          ))}
        </div>
      ) : null}
      <div className={cnAhorroRecipes.top}>
        <GoalRing cuenta={vista.cuenta} meta={vista.meta} puedeConfigurar={vista.puedeConfigurar} />
        <CierreCard cierre={vista.cierre} destino={vista.cuenta.nombre} pasar={pasar} />
      </div>
      <DepositsChart barras={vista.barras} />
    </>
  );
}
