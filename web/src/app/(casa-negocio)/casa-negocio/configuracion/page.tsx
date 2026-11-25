import type { Metadata } from "next";

import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";

export const metadata: Metadata = { title: "Configuración · Casa y Negocio" };

/** Configuración tab: the common header and an empty paper sheet until its content is built. */
export default function ConfiguracionPage() {
  return <ModulePage header={demoHeader("configuracion")} />;
}
