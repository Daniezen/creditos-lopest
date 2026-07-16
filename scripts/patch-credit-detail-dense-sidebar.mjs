import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sidebarPath = join(root, "web/src/components/dashboard/sidebar.tsx");

if (!existsSync(sidebarPath)) {
  throw new Error(`Falta archivo requerido: ${sidebarPath}`);
}

let sidebar = readFileSync(sidebarPath, "utf8");

const oldDefinition = `  const isDenseRoute =
    pathname.startsWith("/reportes") || pathname.startsWith("/creditos/nuevo");`;

const newDefinition = `  const isCreditDetailRoute = /^\\/creditos\\/[^/]+$/.test(pathname);
  const isDenseRoute =
    pathname.startsWith("/reportes") ||
    pathname.startsWith("/creditos/nuevo") ||
    isCreditDetailRoute;`;

if (!sidebar.includes("const isCreditDetailRoute")) {
  if (!sidebar.includes(oldDefinition)) {
    throw new Error("No se encontró la definición actual de isDenseRoute en sidebar.tsx.");
  }

  sidebar = sidebar.replace(oldDefinition, newDefinition);
}

sidebar = sidebar.replace(
  " * - Rutas densas: /reportes y /creditos/nuevo usan 92px.",
  " * - Rutas densas: /reportes, /creditos/nuevo y /creditos/[id] usan 92px.",
);

writeFileSync(sidebarPath, sidebar, "utf8");
console.log("[OK] Los detalles /creditos/[id] usan sidebar compacta de 92px.");
console.log("[OK] /creditos/[id]/editar conserva sidebar normal.");
