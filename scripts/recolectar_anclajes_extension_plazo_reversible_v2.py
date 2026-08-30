#!/usr/bin/env python3
"""Collect exact anchors needed to implement reversible term extensions safely.

Read-only. Produces one shareable TXT under scripts/salidas and prints only its
path. It does not access or modify PostgreSQL.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts/salidas/anclajes_extension_plazo_reversible_v2.txt"

FILES = [
    "web/src/features/creditos/plazos/actions.ts",
    "web/src/app/(dashboard)/creditos/[id]/page.tsx",
    "web/src/app/(dashboard)/creditos/[id]/credito-detalle.module.css",
    "web/src/features/creditos/queries.ts",
    "web/src/features/creditos/abonos/components/abono-reversal-button.tsx",
    "web/src/features/creditos/abonos/components/abono-reversal-button.module.css",
    "web/src/features/creditos/pagos/components/edit-payment-date.tsx",
    "web/src/features/creditos/pagos/payment-date-state.ts",
    "web/src/features/creditos/abonos/snapshot.ts",
    "web/src/features/creditos/abonos/reversibility.ts",
    "web/src/features/creditos/abonos/reversal-actions.ts",
    "web/src/features/creditos/current-capital-balance.ts",
    "web/src/server/audit/audit-log.ts",
    "web/prisma/schema.prisma",
    "web/package.json",
]


def add(parts: list[str], title: str, body: str) -> None:
    parts.append(f"\n{'=' * 100}\n{title}\n{'=' * 100}\n{body.rstrip()}\n")


def main() -> int:
    if not (ROOT / "web/package.json").is_file():
        raise SystemExit("ERROR: run from the Lopest repository root")

    parts = [
        "LOPEST | ANCLAJES EXTENSION PLAZO REVERSIBLE V2\n"
        f"GENERATED_UTC: {dt.datetime.now(dt.timezone.utc).isoformat()}\n"
        "MODE: SOURCE READ ONLY\n"
    ]

    for rel in FILES:
        path = ROOT / rel
        add(parts, f"FILE: {rel}", path.read_text(encoding="utf-8", errors="replace") if path.is_file() else "NOT FOUND")

    migrations = ROOT / "web/prisma/migrations"
    if migrations.is_dir():
        entries = sorted(path for path in migrations.rglob("*") if path.is_file())
        add(parts, "PRISMA MIGRATION INVENTORY", "\n".join(path.relative_to(ROOT).as_posix() for path in entries))
        for path in entries[-6:]:
            add(parts, f"RECENT MIGRATION: {path.relative_to(ROOT)}", path.read_text(encoding="utf-8", errors="replace"))
    else:
        add(parts, "PRISMA MIGRATION INVENTORY", "NOT FOUND")

    tests = sorted(
        path for path in (ROOT / "web/src/features/creditos").rglob("*")
        if path.is_file() and ("test" in path.name or "__tests__" in path.parts)
    )
    add(parts, "CREDIT TEST INVENTORY", "\n".join(path.relative_to(ROOT).as_posix() for path in tests))

    parts.append(
        "\nREQUIRED IMPLEMENTATION CONTRACT\n"
        "- Preserve every paid installment and extraordinary payment byte-for-byte.\n"
        "- Recalculate only operational unpaid installments: PENDIENTE, ATRASADO, MORA.\n"
        "- For Solo Interest, keep current realized principal as the interest base.\n"
        "- Move final principal from the last unpaid installment to the new final installment.\n"
        "- Store exact before/after images plus IDs of created installments in a dedicated snapshot.\n"
        "- Permit reversal only if affected and created events still match the post-extension snapshot.\n"
        "- Block reversal after any payment or abono dependent on the extension.\n"
        "- Return typed visible action feedback instead of throwing an opaque Server Action error.\n"
        "- Record extension and reversal in AuditLog inside the same transaction.\n"
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts), encoding="utf-8")
    print(f"OK: {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
