import { CreditosList } from "@/features/creditos/components/creditos-list";
import { obtenerCreditosParaListado } from "@/features/creditos/queries";

interface CreditosPageProps {
  searchParams: Promise<{
    q?: string;
    estado?: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditosPage({ searchParams }: CreditosPageProps) {
  const params = await searchParams;

  const query = params.q?.trim() ?? "";
  const estado = params.estado?.trim() ?? "";

  const creditos = await obtenerCreditosParaListado({
    query,
    estado,
  });

  return (
    <CreditosList
      creditos={creditos}
      query={query}
      estado={estado}
    />
  );
}
