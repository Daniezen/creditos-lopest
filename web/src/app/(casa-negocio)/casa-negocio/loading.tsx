import { ModuleSkeleton } from "@/components/casa-negocio/states/module-skeleton";

/**
 * Loading state of the Tablero (and of any tab without its own): the module
 * frame with quiet placeholders in the real boxes (`ModuleSkeleton`), so
 * nothing jumps when the month arrives.
 */
export default function CasaNegocioLoading() {
  return <ModuleSkeleton />;
}
