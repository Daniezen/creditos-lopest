#!/usr/bin/env python3
"""Fix generalized Credit export tests and remove stale Next generated types.

Root causes:
- the shared test fixture still selected overdue counts [1, 3], so the scenarios
  labelled "without filters" and "cancelled" were not actually isolated;
- .next retained generated route types for the removed overdue endpoint.

Only the test source is modified. The generated .next directory is safely
removed so Next can rebuild it. Application behavior and PostgreSQL are unchanged.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "web/src/features/creditos/__tests__/credit-export.test.ts"
NEXT_CACHE = ROOT / "web/.next"

OLD_UNFILTERED = '''    expect(seleccionarCreditosParaExportacion([credit, cancelled, current], filters).map((item) => item.codigo)).toEqual([
      "LP-1", "LP-2", "LP-3",
    ]);'''
NEW_UNFILTERED = '''    const selected = seleccionarCreditosParaExportacion([credit, cancelled, current], {
      ...filters,
      cuotasAtrasadas: [],
    });
    expect(selected.map((item) => item.codigo)).toEqual(["LP-1", "LP-2", "LP-3"]);'''

OLD_CANCELLED = '''    const selected = seleccionarCreditosParaExportacion([credit, cancelled], { ...filters, segmento: "CANCELADO" });'''
NEW_CANCELLED = '''    const selected = seleccionarCreditosParaExportacion([credit, cancelled], {
      ...filters,
      segmento: "CANCELADO",
      cuotasAtrasadas: [],
    });'''


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def main() -> int:
    if not TEST.is_file():
        raise SystemExit(f"ERROR: missing {TEST.relative_to(ROOT)}")

    text = TEST.read_text(encoding="utf-8")
    if "cuotasAtrasadas: [],\n    });\n    expect(selected.map" in text:
        raise SystemExit("ERROR: test isolation correction already applied")

    result = replace_once(text, OLD_UNFILTERED, NEW_UNFILTERED, "unfiltered scenario")
    result = replace_once(result, OLD_CANCELLED, NEW_CANCELLED, "cancelled scenario")

    if result.count("cuotasAtrasadas: [],") < 2:
        raise SystemExit("ERROR: final consistency check failed")

    TEST.write_text(result, encoding="utf-8")

    cache_removed = NEXT_CACHE.exists()
    if cache_removed:
        shutil.rmtree(NEXT_CACHE)

    print("OK: isolated unfiltered and cancelled export scenarios")
    print(f"MODIFIED: {TEST.relative_to(ROOT)}")
    print(f"NEXT_CACHE_REMOVED: {'yes' if cache_removed else 'not_present'}")
    print("APPLICATION_BEHAVIOR: unchanged")
    print("DATABASE: unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
