import { CreditosList } from "@/features/creditos/components/creditos-list";
import { parseCreditFilterParams } from "@/features/creditos/credit-filter-params";
import { obtenerVistaCreditosFacetada } from "@/features/creditos/faceted-query";

interface CreditosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CreditosPage({ searchParams }: CreditosPageProps) {
  const params = await searchParams;
  const { filters, page } = parseCreditFilterParams(params);
  const vista = await obtenerVistaCreditosFacetada(filters, page);

  return (
    <CreditosList
      vista={vista}
      query={filters.query}
      estado={filters.segmento === "TODOS" ? "" : filters.segmento}
    />
  );
}
