import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const path = join(process.cwd(), "web/src/app/(dashboard)/creditos/[id]/page.tsx");
if (!existsSync(path)) throw new Error(`Falta archivo: ${path}`);

let text = readFileSync(path, "utf8");
text = text.replace('className="min-w-[1080px] w-full table-fixed', 'className="min-w-[920px] w-full table-fixed');
text = text.replace('<TableHead className="w-[225px]">\n                  Fecha Real', '<TableHead className="w-[118px]">\n                  Fecha Real');

writeFileSync(path, text, "utf8");
console.log("[OK] Restaurados ancho original de tabla y columna Fecha Real.");
