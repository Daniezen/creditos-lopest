import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const detailPath = join(root, "web/src/app/(dashboard)/creditos/[id]/page.tsx");
const listPath = join(root, "web/src/features/creditos/components/creditos-list.tsx");

for (const path of [detailPath, listPath]) {
  if (!existsSync(path)) {
    throw new Error(`Falta archivo requerido: ${path}`);
  }
}

function writeIfChanged(path, next) {
  const current = readFileSync(path, "utf8");
  if (current !== next) {
    writeFileSync(path, next, "utf8");
    return true;
  }
  return false;
}

function ensurePencilLineImport(text) {
  if (text.includes("PencilLine")) {
    return text;
  }

  if (text.includes("  Percent,\n")) {
    return text.replace("  Percent,\n", "  Percent,\n  PencilLine,\n");
  }

  return text.replace("Eye, Plus", "Eye, PencilLine, Plus");
}

function patchDetailPage() {
  let text = readFileSync(detailPath, "utf8");
  text = ensurePencilLineImport(text);

  if (text.includes("Editar crédito")) {
    writeIfChanged(detailPath, text);
    console.log("[OK] Detalle de credito: boton Editar credito ya existia.");
    return;
  }

  const linkStart = text.indexOf('<Link\n              href="/creditos"');
  if (linkStart === -1) {
    throw new Error('No se encontro el Link href="/creditos" en el header del detalle. Ejecuta sed -n "1,120p" del page.tsx.');
  }

  const linkEndMarker = "\n            </Link>";
  const linkEnd = text.indexOf(linkEndMarker, linkStart);
  if (linkEnd === -1) {
    throw new Error("No se encontro cierre del Link Volver en el detalle del credito.");
  }

  const originalLink = text.slice(linkStart, linkEnd + linkEndMarker.length);
  const editAndBackBlock = `            <div className="flex flex-wrap gap-2">
              <Link
                href={\`/creditos/\${credito.id}/editar\`}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <PencilLine className="h-4 w-4" />
                Editar crédito
              </Link>

${originalLink}
            </div>`;

  text = text.slice(0, linkStart) + editAndBackBlock + text.slice(linkEnd + linkEndMarker.length);
  writeIfChanged(detailPath, text);
  console.log("[OK] Detalle de credito: boton Editar credito agregado junto a Volver.");
}

function patchListPageBestEffort() {
  let text = readFileSync(listPath, "utf8");
  text = ensurePencilLineImport(text);

  let changed = false;

  if (!text.includes("/editar`}")) {
    const desktopRegex = /<TableCell className="text-right"><Link href=\{`\/creditos\/\$\{credito\.id\}`}[\s\S]*?<Eye className="h-3\.5 w-3\.5" \/>Ver<\/Link><\/TableCell>/;
    const desktopReplacement = `<TableCell className="text-right"><div className="flex justify-end gap-2"><Link href={\`/creditos/\${credito.id}/editar\`} className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-100 hover:text-fuchsia-700"><PencilLine className="h-3.5 w-3.5" />Editar</Link><Link href={\`/creditos/\${credito.id}\`} className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"><Eye className="h-3.5 w-3.5" />Ver</Link></div></TableCell>`;

    if (desktopRegex.test(text)) {
      text = text.replace(desktopRegex, desktopReplacement);
      changed = true;
    } else {
      console.warn("[WARN] No se pudo parchear accion desktop del listado automaticamente.");
    }
  }

  const mobileNeedle = `<Link href={\`/creditos/\${credito.id}\`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-fuchsia-700"><Eye className="h-3.5 w-3.5" />Ver</Link>`;
  if (text.includes(mobileNeedle) && !text.includes(`href={\`/creditos/\${credito.id}/editar\`}`)) {
    const mobileReplacement = `<div className="flex shrink-0 gap-2"><Link href={\`/creditos/\${credito.id}/editar\`} className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-100 hover:text-fuchsia-700"><PencilLine className="h-3.5 w-3.5" />Editar</Link>${mobileNeedle}</div>`;
    text = text.replace(mobileNeedle, mobileReplacement);
    changed = true;
  }

  writeIfChanged(listPath, text);
  console.log(changed ? "[OK] Listado de creditos: accion Editar agregada donde fue posible." : "[OK] Listado de creditos: sin cambios necesarios o parche parcial no aplicable.");
}

patchDetailPage();
patchListPageBestEffort();
console.log("[OK] Patch v3 finalizado.");
