import { TransferenciasPageContent } from "@/features/transferencias/components/transferencias-page-content";
import { obtenerTransferenciasContext } from "@/features/transferencias/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TransferenciasPage() {
  const context = await obtenerTransferenciasContext();

  return <TransferenciasPageContent context={context} />;
}
