import { cnCardRecipes, cnCasaRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { VistaCasa } from "@/server/casa-negocio/vista-casa";

import { CASA_NEGOCIO_HREF } from "../shell/rail-items";
import { Notice } from "../shared/notice";
import { AnotarCasa } from "./anotar-casa";
import type { OpcionesEdicion } from "./editar-movimiento";
import { FijosDelMes, SobresDelMes } from "./fijos-sobres";
import { Franja } from "./franja";
import { LibroCasa } from "./libro-casa";

export interface CasaTabProps {
  vista: VistaCasa;
  fijoInicial?: string;
}

/**
 * Casa tab content (`Casa.dc.html`): strip and equation, «Anotar en la
 * casa», the book by day and, on the right, the month's fijos and sobres.
 * Without `casa_negocio.anotar` the form and the edit buttons are not drawn
 * (the header already shows «Solo lectura»).
 */
export function CasaTab({ vista, fijoInicial }: CasaTabProps) {
  const { ecuacion, formulario } = vista;
  const edicion: OpcionesEdicion | null = vista.puedeAnotar
    ? {
        cuentasCasa: formulario.cuentas,
        cuentasNegocio: [],
        fijos: formulario.fijos,
        sobres: formulario.sobres,
        hoy: vista.hoy,
        avisoSinSaldo: formulario.avisoSinSaldo,
      }
    : null;

  return (
    <>
      <Franja
        identidad="casa"
        terminos={[
          { op: "", label: "Entró", monto: ecuacion.entro },
          { op: "−", label: "Fijos", monto: ecuacion.fijos },
          { op: "−", label: "Variables", monto: ecuacion.variables },
          { op: "=", label: "Hoy", monto: ecuacion.hoy, resultado: true },
        ]}
      />

      {vista.puedeAnotar ? (
        vista.sinCuentas ? (
          <section aria-label="Anotar en la casa" className={cnCardRecipes.card}>
            <Notice
              level="atencion"
              action={vista.puedeConfigurar ? { label: "Crear una cuenta", href: `${CASA_NEGOCIO_HREF}/configuracion` } : undefined}
            >
              Para anotar falta una cuenta de la casa.
            </Notice>
          </section>
        ) : (
          <AnotarCasa formulario={formulario} hoy={vista.hoy} fijoInicial={fijoInicial} />
        )
      ) : null}

      <div className={cnCasaRecipes.layout}>
        <LibroCasa libro={vista.libro} nombreMes={vista.nombreMes} edicion={edicion} />
        <aside className={cnCasaRecipes.aside} aria-label="Fijos y sobres del mes">
          <FijosDelMes fijos={vista.fijos} nombreMes={vista.nombreMes} />
          <SobresDelMes sobres={vista.sobres} nombreMes={vista.nombreMes} />
        </aside>
      </div>
    </>
  );
}
