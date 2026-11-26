import { cnCardRecipes } from "@/design-system/recipes/casa-negocio-libros";
import type { VistaNegocio } from "@/server/casa-negocio/vista-negocio";

import type { OpcionesEdicion } from "../casa/editar-movimiento";
import { Franja } from "../casa/franja";
import { Notice } from "../shared/notice";
import { CASA_NEGOCIO_HREF } from "../shell/rail-items";
import { AnotarNegocio } from "./anotar-negocio";
import { LibroCaja } from "./libro-caja";
import { SinCuenta } from "./sin-cuenta";

/**
 * Negocio tab content (`Negocio.dc.html`): strip and equation, the accounts
 * as filters, «Anotar en el negocio», what is still without account and the
 * cash book. Without `casa_negocio.anotar` nothing can be written: no form,
 * no pickers, no edit buttons.
 */
export function NegocioTab({ vista }: { vista: VistaNegocio }) {
  const { ecuacion, formulario } = vista;
  const edicion: OpcionesEdicion | null = vista.puedeAnotar
    ? {
        cuentasCasa: formulario.cuentasCasa,
        cuentasNegocio: formulario.cuentasNegocio,
        fijos: [],
        sobres: [],
        hoy: vista.hoy,
        avisoSinSaldo: formulario.avisoSinSaldo,
      }
    : null;
  const otrosMeses = vista.sinCuenta.filter((p) => !p.fecha.startsWith(vista.mes));

  return (
    <>
      <Franja
        identidad="negocio"
        terminos={[
          { op: "", label: "Intereses", monto: ecuacion.intereses },
          { op: "−", label: "Gastos", monto: ecuacion.gastos },
          { op: "−", label: "Perdidos", monto: ecuacion.perdidos },
          { op: "=", label: "Ganancia", monto: ecuacion.ganancia, resultado: true },
          { op: "−", label: "A la casa", monto: ecuacion.aCasa },
          { op: "=", label: "Reinvertido", monto: ecuacion.reinvertido, resultado: true },
        ]}
      />

      {vista.sinCuentas ? (
        <section aria-label="Cuentas del negocio" className={cnCardRecipes.card}>
          <Notice
            level="atencion"
            action={vista.puedeConfigurar ? { label: "Crear una cuenta", href: `${CASA_NEGOCIO_HREF}/configuracion` } : undefined}
          >
            Aún no hay cuentas del negocio: los cobros y préstamos quedan sin cuenta.
          </Notice>
        </section>
      ) : null}

      <LibroCaja
        filtros={vista.filtros}
        libro={vista.libro}
        nombreMes={vista.nombreMes}
        cuentasNegocio={formulario.cuentasNegocio}
        sugerida={vista.sugerida}
        edicion={vista.sinCuentas ? null : edicion}
      >
        {edicion && !vista.sinCuentas ? <AnotarNegocio formulario={formulario} hoy={vista.hoy} /> : null}
        {edicion && !vista.sinCuentas ? <SinCuenta pendientes={otrosMeses} cuentas={formulario.cuentasNegocio} sugerida={vista.sugerida} /> : null}
      </LibroCaja>
    </>
  );
}
