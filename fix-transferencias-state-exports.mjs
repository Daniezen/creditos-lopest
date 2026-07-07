import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const actionsPath = join(root, "web/src/features/transferencias/actions.ts");
const statePath = join(root, "web/src/features/transferencias/state.ts");
const pagePath = join(root, "web/src/features/transferencias/components/transferencias-page-content.tsx");

for (const path of [actionsPath, pagePath]) {
  if (!existsSync(path)) {
    throw new Error(`Falta archivo requerido: ${path}`);
  }
}

writeFileSync(
  statePath,
  `export interface TransferActionState {\n  ok: boolean;\n  message: string | null;\n}\n\nexport const initialTransferActionState: TransferActionState = {\n  ok: false,\n  message: null,\n};\n`,
  "utf8",
);

let actions = readFileSync(actionsPath, "utf8");

actions = actions.replace(
  /\nexport interface TransferActionState \{\n\s*ok: boolean;\n\s*message: string \| null;\n\}\n\nexport const initialTransferActionState: TransferActionState = \{\n\s*ok: false,\n\s*message: null,\n\};\n/s,
  "\n",
);

if (!actions.includes('import type { TransferActionState } from "./state";')) {
  const lines = actions.split("\n");
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("import ")) {
      insertIndex = i;
    }
  }

  if (insertIndex === -1) {
    throw new Error("No se encontraron imports en actions.ts para insertar el tipo TransferActionState.");
  }

  lines.splice(insertIndex + 1, 0, 'import type { TransferActionState } from "./state";');
  actions = lines.join("\n");
}

writeFileSync(actionsPath, actions, "utf8");

let page = readFileSync(pagePath, "utf8");
page = page.replace(/\s*initialTransferActionState,\n/g, "\n");

if (!page.includes('import { initialTransferActionState } from "../state";')) {
  const lines = page.split("\n");
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("import ")) {
      insertIndex = i;
    }
  }

  if (insertIndex === -1) {
    throw new Error("No se encontraron imports en transferencias-page-content.tsx para insertar initialTransferActionState.");
  }

  lines.splice(insertIndex + 1, 0, 'import { initialTransferActionState } from "../state";');
  page = lines.join("\n");
}

writeFileSync(pagePath, page, "utf8");

console.log("[OK] actions.ts ya solo exporta server actions async.");
console.log("[OK] state.ts creado con initialTransferActionState.");
console.log("[OK] transferencias-page-content.tsx importa el estado desde ../state.");
