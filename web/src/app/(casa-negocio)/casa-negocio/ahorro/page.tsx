import type { Metadata } from "next";

import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";

export const metadata: Metadata = { title: "Ahorro · Casa y Negocio" };

/** Ahorro tab: the common header and an empty paper sheet until its content is built. */
export default function AhorroPage() {
  return <ModulePage header={demoHeader("ahorro")} />;
}
