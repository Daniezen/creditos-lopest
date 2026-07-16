import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pagePath = join(
  process.cwd(),
  "web/src/app/(dashboard)/creditos/[id]/page.tsx",
);

if (!existsSync(pagePath)) {
  throw new Error(`Falta archivo requerido: ${pagePath}`);
}

let page = readFileSync(pagePath, "utf8");

if (page.includes("function EstadoCreditoBadge(")) {
  console.log("[OK] EstadoCreditoBadge ya existe. No se hicieron cambios.");
  process.exit(0);
}

const insertionMarker = "function formatFrecuencia(value: string): string {";
const markerIndex = page.indexOf(insertionMarker);

if (markerIndex === -1) {
  throw new Error(
    "No se encontro function formatFrecuencia para insertar EstadoCreditoBadge.",
  );
}

const badgeFunction = `function EstadoCreditoBadge({ estado }: { estado: string }) {
  if (estado === "ACTIVO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Activo
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
      {formatEnumLabel(estado)}
    </span>
  );
}

`;

page =
  page.slice(0, markerIndex) + badgeFunction + page.slice(markerIndex);

writeFileSync(pagePath, page, "utf8");

console.log("[OK] EstadoCreditoBadge restaurado en el detalle del credito.");
console.log("[OK] CheckCircle2 vuelve a estar utilizado.");
