import type { CreditFacetFilters } from "./credit-facets";
import { cargarCreditosAutorizados } from "./faceted-query";
import { construirReporteExcelCreditos, seleccionarCreditosParaExportacion, type CreditExportResult } from "./credit-export";

/** Loads the authorized universe and exports exactly the active filtered results. */
export async function generarReporteExcelCreditos(
  filters: CreditFacetFilters,
  generatedBy: string,
  now = new Date(),
): Promise<CreditExportResult> {
  const authorized = await cargarCreditosAutorizados();
  const matching = seleccionarCreditosParaExportacion(authorized, filters);
  return construirReporteExcelCreditos(matching, filters, generatedBy, now);
}
