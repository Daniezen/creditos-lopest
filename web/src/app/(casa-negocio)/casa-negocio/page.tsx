import type { Metadata } from "next";

import { DEMO_CALENDAR_OPEN_DAY, demoHeader, demoTablero } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";
import { Tablero } from "@/components/casa-negocio/tablero/tablero";

export const metadata: Metadata = { title: "Casa y Negocio" };

/**
 * Tablero tab. For now it shows the approved canvas' example
 * (`fixtures/canvas-noviembre.ts`); the data and engine layers replace the
 * fixtures with the real month without touching the components.
 */
export default function TableroPage() {
  const header = demoHeader("tablero");
  return (
    <ModulePage header={header}>
      <Tablero data={demoTablero} readOnly={header.readOnly} calendarOpenDay={DEMO_CALENDAR_OPEN_DAY} />
    </ModulePage>
  );
}
