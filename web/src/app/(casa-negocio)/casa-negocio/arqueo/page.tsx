import type { Metadata } from "next";

import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";

export const metadata: Metadata = { title: "Arqueo · Casa y Negocio" };

/** Arqueo tab: the common header and an empty paper sheet until its content is built. */
export default function ArqueoPage() {
  return <ModulePage header={demoHeader("arqueo")} />;
}
