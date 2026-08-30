#!/usr/bin/env python3
"""Generalize the Credits Excel export to exactly match active filters.

Renames the overdue-specific endpoint and modules, removes the mandatory overdue
constraint, preserves the optional overdue-detail sheet, and adds pure tests for
unfiltered, cancelled, and multiple overdue-count scenarios. No database changes.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
LIST = WEB / "src/features/creditos/components/creditos-list.tsx"
OLD_EXPORT = WEB / "src/features/creditos/overdue-export.ts"
NEW_EXPORT = WEB / "src/features/creditos/credit-export.ts"
OLD_QUERY = WEB / "src/features/creditos/overdue-export-query.ts"
NEW_QUERY = WEB / "src/features/creditos/credit-export-query.ts"
OLD_ROUTE = WEB / "src/app/api/creditos/exportar-atrasados/route.ts"
NEW_ROUTE = WEB / "src/app/api/creditos/exportar-resultados/route.ts"
OLD_TEST = WEB / "src/features/creditos/__tests__/overdue-export.test.ts"
NEW_TEST = WEB / "src/features/creditos/__tests__/credit-export.test.ts"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def main() -> int:
    required = (LIST, OLD_EXPORT, OLD_QUERY, OLD_ROUTE, OLD_TEST)
    for path in required:
        if not path.is_file():
            raise SystemExit(f"ERROR: missing {path.relative_to(ROOT)}")
    for path in (NEW_EXPORT, NEW_QUERY, NEW_ROUTE, NEW_TEST):
        if path.exists():
            raise SystemExit(f"ERROR: target already exists: {path.relative_to(ROOT)}")

    listing = LIST.read_text(encoding="utf-8")
    export = OLD_EXPORT.read_text(encoding="utf-8")
    query = OLD_QUERY.read_text(encoding="utf-8")
    route = OLD_ROUTE.read_text(encoding="utf-8")
    test = OLD_TEST.read_text(encoding="utf-8")

    listing = listing.replace("buildOverdueExportHref", "buildCreditExportHref")
    listing = replace_once(
        listing,
        'title="Exportar atrasados a Excel"\n              aria-label="Exportar atrasados a Excel"',
        'title="Exportar resultados a Excel"\n              aria-label="Exportar resultados a Excel"',
        "generic export accessible name",
    )
    listing = listing.replace(
        'return query ? `/api/creditos/exportar-atrasados?${query}` : "/api/creditos/exportar-atrasados";',
        'return query ? `/api/creditos/exportar-resultados?${query}` : "/api/creditos/exportar-resultados";',
    )
    if "exportar-atrasados" in listing or "buildOverdueExportHref" in listing:
        raise SystemExit("ERROR: overdue-specific list references remain")

    export = replace_once(
        export,
        'import type { CreditFacetFilters, CreditFacetSource } from "./credit-facets";',
        'import { matchesCreditFilters, type CreditFacetFilters, type CreditFacetSource } from "./credit-facets";',
        "pure filter import",
    )
    export = export.replace("OverdueExportResult", "CreditExportResult")
    export = export.replace("construirReporteExcelAtrasados", "construirReporteExcelCreditos")
    export = replace_once(
        export,
        "/** Pure workbook builder kept separate so report structure is testable without a database. */",
        '''/** Returns every authorized credit matching the same filters used by the screen. */
export function seleccionarCreditosParaExportacion(
  credits: CreditFacetSource[],
  filters: CreditFacetFilters,
): CreditFacetSource[] {
  return credits.filter((credit) => matchesCreditFilters(credit, filters));
}

/** Pure workbook builder kept separate so report structure is testable without a database. */''',
        "pure selection helper",
    )
    export = replace_once(export, '["Reporte", "Créditos con cuotas atrasadas"]', '["Reporte", "Resultados de créditos"]', "report title")
    export = replace_once(export, '["Créditos con atraso", credits.length]', '["Créditos exportados", credits.length]', "summary credit count")
    export = replace_once(
        export,
        'fileName: `reporte-atrasados-${date}.xlsx`,',
        'fileName: `creditos-filtrados-${date}.xlsx`,',
        "generic filename",
    )
    export = replace_once(
        export,
        'return applied.length ? applied.join(" · ") : "Sin filtros adicionales; se aplicó atraso obligatorio";',
        'return applied.length ? applied.join(" · ") : "Sin filtros; se exportaron todos los créditos autorizados";',
        "unfiltered description",
    )

    query = query.replace('import { matchesCreditFilters, type CreditFacetFilters } from "./credit-facets";', 'import type { CreditFacetFilters } from "./credit-facets";')
    query = query.replace(
        'import { construirReporteExcelAtrasados, type OverdueExportResult } from "./overdue-export";',
        'import { construirReporteExcelCreditos, seleccionarCreditosParaExportacion, type CreditExportResult } from "./credit-export";',
    )
    query = query.replace('import { derivarCreditoOperativo } from "./portfolio-summary";\n', '')
    old_function = '''/** Loads every authorized match, then enforces the report's overdue-only scope. */
export async function generarReporteExcelAtrasados(
  filters: CreditFacetFilters,
  generatedBy: string,
  now = new Date(),
): Promise<OverdueExportResult> {
  const authorized = await cargarCreditosAutorizados();
  const overdueMatches = authorized.filter((credit) => {
    const operational = derivarCreditoOperativo(credit);
    return operational.tieneCuotasVencidas && matchesCreditFilters(credit, filters);
  });
  return construirReporteExcelAtrasados(overdueMatches, filters, generatedBy, now);
}
'''
    new_function = '''/** Loads the authorized universe and exports exactly the active filtered results. */
export async function generarReporteExcelCreditos(
  filters: CreditFacetFilters,
  generatedBy: string,
  now = new Date(),
): Promise<CreditExportResult> {
  const authorized = await cargarCreditosAutorizados();
  const matching = seleccionarCreditosParaExportacion(authorized, filters);
  return construirReporteExcelCreditos(matching, filters, generatedBy, now);
}
'''
    query = replace_once(query, old_function, new_function, "query behavior")

    route = route.replace("overdue-export-query", "credit-export-query")
    route = route.replace("generarReporteExcelAtrasados", "generarReporteExcelCreditos")
    route = route.replace("[credit-overdue-export]", "[credit-results-export]")
    route = route.replace("No se pudo generar el reporte de atrasados.", "No se pudo exportar los resultados de créditos.")

    test = test.replace('import { construirReporteExcelAtrasados } from "../overdue-export";', 'import { construirReporteExcelCreditos, seleccionarCreditosParaExportacion } from "../credit-export";')
    test = test.replace('describe("reporte Excel de atrasados"', 'describe("exportación Excel de resultados"')
    test = test.replace("segmento: \"VENCIDA\"", "segmento: \"TODOS\"")
    test = test.replace("construirReporteExcelAtrasados", "construirReporteExcelCreditos")
    test = test.replace('expect(result.fileName).toBe("reporte-atrasados-2026-08-12.xlsx");', 'expect(result.fileName).toBe("creditos-filtrados-2026-08-12.xlsx");')
    extra_tests = r'''

  it("sin filtros conserva todos los créditos autorizados", () => {
    const cancelled = { ...credit, id: "c2", codigo: "LP-2", estado: "CANCELADO" as const, eventos: [] };
    const current = { ...credit, id: "c3", codigo: "LP-3", eventos: [] };
    expect(seleccionarCreditosParaExportacion([credit, cancelled, current], filters).map((item) => item.codigo)).toEqual([
      "LP-1", "LP-2", "LP-3",
    ]);
  });

  it("exporta únicamente cancelados cuando ese estado está activo", () => {
    const cancelled = { ...credit, id: "c2", codigo: "LP-2", estado: "CANCELADO" as const, eventos: [] };
    const selected = seleccionarCreditosParaExportacion([credit, cancelled], { ...filters, segmento: "CANCELADO" });
    expect(selected.map((item) => item.codigo)).toEqual(["LP-2"]);
  });

  it("respeta múltiples cantidades exactas de cuotas atrasadas", () => {
    const three = {
      ...credit,
      id: "c3",
      codigo: "LP-3",
      eventos: Array.from({ length: 3 }, (_, index) => ({
        ...credit.eventos[0], numeroCuota: index + 1,
      })),
    };
    const two = {
      ...credit,
      id: "c2",
      codigo: "LP-2",
      eventos: Array.from({ length: 2 }, (_, index) => ({
        ...credit.eventos[0], numeroCuota: index + 1,
      })),
    };
    const selected = seleccionarCreditosParaExportacion([credit, two, three], {
      ...filters,
      cuotasAtrasadas: [1, 3],
    });
    expect(selected.map((item) => item.codigo)).toEqual(["LP-1", "LP-3"]);
  });
'''
    test = replace_once(test, "\n});\n", extra_tests + "\n});\n", "scenario tests")

    checks = {
        "generic endpoint": "exportar-resultados" in listing,
        "generic tooltip": "Exportar resultados a Excel" in listing,
        "no mandatory overdue query": "tieneCuotasVencidas" not in query and "overdueMatches" not in query,
        "filtered selection": "seleccionarCreditosParaExportacion" in query,
        "generic filename": "creditos-filtrados-" in export,
        "three requested scenarios": all(marker in test for marker in ("sin filtros", "únicamente cancelados", "múltiples cantidades")),
    }
    failed = [label for label, passed in checks.items() if not passed]
    if failed:
        raise SystemExit("ERROR: consistency check failed: " + ", ".join(failed))

    atomic_write(LIST, listing)
    atomic_write(NEW_EXPORT, export)
    atomic_write(NEW_QUERY, query)
    atomic_write(NEW_ROUTE, route)
    atomic_write(NEW_TEST, test)

    for path in (OLD_EXPORT, OLD_QUERY, OLD_ROUTE, OLD_TEST):
        path.unlink()
    try:
        OLD_ROUTE.parent.rmdir()
    except OSError:
        pass

    print("OK: Excel export now matches all active filters without forcing overdue status")
    print("ENDPOINT: /api/creditos/exportar-resultados")
    print("FILENAME: creditos-filtrados-YYYY-MM-DD.xlsx")
    print("OVERDUE_SHEET: retained as optional detail")
    print("DATABASE: unchanged")
    for path in (LIST, NEW_EXPORT, NEW_QUERY, NEW_ROUTE, NEW_TEST):
        print(f"MODIFIED_OR_CREATED: {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
