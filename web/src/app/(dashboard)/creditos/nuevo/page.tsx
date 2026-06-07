import { obtenerClientesParaSelector } from "@/features/clientes/queries";
import { CreateCreditPageContent } from "@/features/creditos/crear/create-credit-page-content";

export default async function NuevoCreditoPage() {
  const clientes = await obtenerClientesParaSelector();

  return <CreateCreditPageContent initialClientes={clientes} />;
}