import type { Metadata } from "next";

import { ModulePage } from "@/components/casa-negocio/module-page";
import { ModuleState } from "@/components/casa-negocio/states/module-state";
import { Tablero } from "@/components/casa-negocio/tablero/tablero";
import { cargarVistaMes, encabezadoModulo, type PaginaModuloProps } from "@/server/casa-negocio/pagina";
import { construirTablero } from "@/server/casa-negocio/vista-tablero";

export const metadata: Metadata = { title: "Casa y Negocio" };

/**
 * Tablero tab: the active month (`?mes=AAAA-MM`) read from the database,
 * run through the engine and the alert evaluator with the saved
 * configuration (`construirTablero`). Without accounts there is nothing to
 * show yet, so it points to Configuración; a month before the module's start
 * shows only where it starts.
 */
export default async function TableroPage({ searchParams }: PaginaModuloProps) {
  const vista = await cargarVistaMes(searchParams);
  const header = encabezadoModulo(vista, "tablero");
  const tablero = construirTablero(vista.datos, vista.evaluado);

  if (tablero.estado === "sin-cuentas") {
    return (
      <ModulePage header={header}>
        <ModuleState
          title="Todavía no hay cuentas"
          text={
            tablero.puedeConfigurar
              ? "Crea las cuentas del negocio y de la casa con su saldo inicial para empezar."
              : "Quien configura el módulo debe crear las cuentas para empezar."
          }
          action={tablero.puedeConfigurar ? { label: "Ir a Configuración", href: tablero.hrefConfiguracion } : undefined}
        />
      </ModulePage>
    );
  }

  if (tablero.estado === "antes-del-inicio") {
    return (
      <ModulePage header={header}>
        <ModuleState title={tablero.titulo} action={tablero.accion} />
      </ModulePage>
    );
  }

  return (
    <ModulePage header={header}>
      <Tablero data={tablero.data} readOnly={header.readOnly} />
    </ModulePage>
  );
}
