import type { Metadata } from "next";

import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";

export const metadata: Metadata = { title: "Resumen · Casa y Negocio" };

/** Resumen tab: the common header and an empty paper sheet until its content is built. */
export default function ResumenPage() {
  return <ModulePage header={demoHeader("resumen")} />;
}
