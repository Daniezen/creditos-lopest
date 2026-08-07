import { ClientesList } from "@/features/clientes/components/clientes-list";
import { obtenerClientesParaListado } from "@/features/clientes/queries";

interface ClientesPageProps {
  searchParams: Promise<{
    q?: string;
    estadoDocumentos?: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Loads the authorized client set once. Search and document-state filtering are
 * local and URL-synchronized, avoiding a server round trip on every keystroke.
 * Server ownership rules remain enforced by obtenerClientesParaListado().
 */
export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const estadoDocumentos = params.estadoDocumentos?.trim() ?? "";
  const clientes = await obtenerClientesParaListado();

  return (
    <ClientesList
      clientes={clientes}
      query={query}
      estadoDocumentos={estadoDocumentos}
    />
  );
}
