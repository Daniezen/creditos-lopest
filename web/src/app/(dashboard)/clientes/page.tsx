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

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const params = await searchParams;

  const query = params.q?.trim() ?? "";
  const estadoDocumentos = params.estadoDocumentos?.trim() ?? "";

  const clientes = await obtenerClientesParaListado({
    query,
    estadoDocumentos,
  });

  return (
    <ClientesList
      clientes={clientes}
      query={query}
      estadoDocumentos={estadoDocumentos}
    />
  );
}
