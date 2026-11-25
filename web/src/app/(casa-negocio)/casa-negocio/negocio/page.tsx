import type { Metadata } from "next";

import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";

export const metadata: Metadata = { title: "Negocio · Casa y Negocio" };

/** Negocio tab: the common header and an empty paper sheet until its content is built. */
export default function NegocioPage() {
  return <ModulePage header={demoHeader("negocio")} />;
}
