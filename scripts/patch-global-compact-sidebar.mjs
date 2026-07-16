import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "web/src/components/dashboard/sidebar.tsx");
if (!existsSync(path)) throw new Error(`Falta archivo: ${path}`);
let text = readFileSync(path, "utf8");

text = text.replace(
  'isDenseRoute ? "h-10 w-10" : "h-16 w-16"',
  'isDenseRoute ? "h-10 w-10" : "h-12 w-12"',
);
text = text.replace(
  'isDenseRoute ? "h-14 w-14" : "h-16 w-16"',
  'isDenseRoute ? "h-10 w-10" : "h-12 w-12"',
);
text = text.replace('text-2xl font-black', 'text-xl font-black');
text = text.replace('text-xl font-medium', 'text-base font-medium');
text = text.replace('isDenseRoute ? "justify-center" : "gap-4"', 'isDenseRoute ? "justify-center" : "gap-3"');

writeFileSync(path, text, "utf8");
console.log("[OK] Logo y textos de marca reducidos globalmente.");
console.log("[OK] Sidebar normal conserva textos y acciones, con menor ancho.");
