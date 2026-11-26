import { cnConfigRecipes as r } from "@/design-system/recipes/casa-negocio-configuracion";
import type { VistaConfiguracion } from "@/server/casa-negocio/vista-configuracion";

import { Avisos } from "./avisos";
import { Cuentas } from "./cuentas";
import { Gastos } from "./gastos";
import { Permisos } from "./permisos";

/** The four sections of `Configuracion.dc.html`, in the canvas order. */
export function Configuracion({ vista }: { vista: VistaConfiguracion }) {
  const { puedeConfigurar } = vista;
  return (
    <>
      <Cuentas cuentas={vista.cuentas} configuracion={vista.configuracion} puedeConfigurar={puedeConfigurar} hoy={vista.hoy} />
      <Gastos gastos={vista.gastos} configuracion={vista.configuracion} puedeConfigurar={puedeConfigurar} />
      <Avisos avisos={vista.avisos} puedeConfigurar={puedeConfigurar} />
      <Permisos personas={vista.personas} puedeConfigurar={puedeConfigurar} />
    </>
  );
}

/** Placeholder with the sections' footprint while the server reads. */
export function ConfiguracionCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando la configuración" className="contents">
      <div className={r.section}>
        <div className={`${r.skeleton} ${r.skeletonTitle}`} />
        <div className={r.accounts}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`${r.skeleton} ${r.skeletonCard}`} />
          ))}
        </div>
      </div>
      <div className={r.section}>
        <div className={`${r.skeleton} ${r.skeletonTitle}`} />
        <div className={r.columns}>
          <div className={`${r.skeleton} ${r.skeletonColumn}`} />
          <div className={`${r.skeleton} ${r.skeletonColumn}`} />
        </div>
      </div>
      <div className={r.section}>
        <div className={`${r.skeleton} ${r.skeletonTitle}`} />
        <div className={`${r.skeleton} ${r.skeletonList}`} />
      </div>
    </div>
  );
}

export function ConfiguracionAviso({ children }: { children: React.ReactNode }) {
  return <p className={r.notice}>{children}</p>;
}
