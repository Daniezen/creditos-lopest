#!/usr/bin/env python3
"""Collect focused context for safe, reversible credit-term extension in Lopest.

Read-only collector. Writes one shareable TXT under scripts/salidas and prints
only success plus its path. It does not query or modify PostgreSQL.
"""
from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts/salidas/contexto_extension_plazo_reversible_v1.txt"

FULL = [
    "web/src/features/creditos/plazos/actions.ts",
    "web/src/features/creditos/plazos/extension-plazo-form.tsx",
    "web/src/features/creditos/plazos/extend-term-form.tsx",
    "web/src/features/creditos/plazos/policy.ts",
    "web/src/features/creditos/plazos/queries.ts",
    "web/src/features/creditos/plazos/types.ts",
    "web/src/features/creditos/pagos/overdue-policy.ts",
    "web/src/features/creditos/portfolio-summary.ts",
    "web/prisma/schema.prisma",
]

ROOTS = [
    "web/src/features/creditos",
    "web/src/app/(dashboard)/creditos",
    "web/src/domain/creditos",
    "web/prisma",
]

PATTERN = re.compile(
    r"extender|extensi[oó]n|plazo|revert|snapshot|historial|auditor|"
    r"eventoTieneActividadFinanciera|CUOTA_PROGRAMADA|CANCELADO_POR_ABONO|"
    r"PAGADO|PARCIAL|ABONO|SOLO_INTERES|useActionState|formState|message|error",
    re.I,
)


def section(title: str, body: str) -> str:
    return f"\n{'=' * 96}\n{title}\n{'=' * 96}\n{body.rstrip()}\n"


def read(path: Path, limit: int = 140_000) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    return text if len(text) <= limit else text[:limit] + "\n[TRUNCATED]\n"


def excerpts(text: str, radius: int = 16) -> str:
    lines = text.splitlines()
    keep: set[int] = set()
    for i, line in enumerate(lines):
        if PATTERN.search(line):
            keep.update(range(max(0, i - radius), min(len(lines), i + radius + 1)))
    if not keep:
        return "NO MATCHES"
    out: list[str] = []
    previous = -2
    for i in sorted(keep):
        if i > previous + 1:
            out.append("...")
        out.append(f"{i + 1:5d}: {lines[i]}")
        previous = i
    return "\n".join(out)


def main() -> int:
    if not (ROOT / "web/package.json").is_file():
        raise SystemExit("ERROR: run from the Lopest repository root after copying this file into scripts")

    parts = [
        "LOPEST | CONTEXTO EXTENSION DE PLAZO REVERSIBLE V1\n"
        f"GENERATED_UTC: {dt.datetime.now(dt.timezone.utc).isoformat()}\n"
        "MODE: SOURCE READ ONLY\n"
        "KNOWN_FAILURE: current action rejects any credit with financial activity\n",
    ]

    included: set[Path] = set()
    for rel in FULL:
        path = ROOT / rel
        if path.is_file():
            included.add(path)
            parts.append(section(f"FULL SOURCE: {rel}", read(path)))
        else:
            parts.append(section(f"MISSING CANDIDATE: {rel}", "NOT FOUND"))

    discovered: list[Path] = []
    for rel_root in ROOTS:
        base = ROOT / rel_root
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path in included or path.suffix not in {".ts", ".tsx", ".mjs", ".prisma"}:
                continue
            if any(part in {"node_modules", ".next", ".git"} for part in path.parts):
                continue
            try:
                text = read(path)
            except OSError:
                continue
            if PATTERN.search(text):
                discovered.append(path)

    for path in sorted(discovered):
        parts.append(section(f"MATCHING EXCERPTS: {path.relative_to(ROOT)}", excerpts(read(path))))

    test_files = sorted(
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "web/src/features/creditos").rglob("*test*")
        if path.is_file() and PATTERN.search(read(path))
    )
    parts.append(section("RELEVANT TEST FILES", "\n".join(test_files) or "NONE FOUND"))

    parts.append(section(
        "DESIGN QUESTIONS TO RESOLVE FROM SOURCE",
        "1. Which events count as paid, partial, overdue, future, or historical.\n"
        "2. Whether extension appends installments or rebuilds only unpaid installments.\n"
        "3. Exact snapshot persistence model and whether it already supports reversal.\n"
        "4. How prior payments and capital snapshots remain immutable.\n"
        "5. How reversal detects later dependent movements and blocks unsafe rollback.\n"
        "6. How server-action errors are returned and rendered to the operator.\n"
        "7. Required transaction boundaries, authorization, audit, and idempotency.\n"
        "8. Tests needed for paid, partially paid, overdue, future, extension, and reversal cases.",
    ))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts), encoding="utf-8")
    print(f"OK: {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
