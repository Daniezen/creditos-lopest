import { ConfiguracionCargando } from "@/components/casa-negocio/configuracion/configuracion";
import { demoHeader } from "@/components/casa-negocio/fixtures/canvas-noviembre";
import { ModulePage } from "@/components/casa-negocio/module-page";

export default function ConfiguracionLoading() {
  return (
    <ModulePage header={demoHeader("configuracion")}>
      <ConfiguracionCargando />
    </ModulePage>
  );
}
