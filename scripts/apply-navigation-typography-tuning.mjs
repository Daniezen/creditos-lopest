import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sidebarPath = join(root, "web/src/components/dashboard/sidebar.tsx");
const sidebarCssPath = join(
  root,
  "web/src/components/dashboard/sidebar.module.css",
);
const topbarPath = join(
  root,
  "web/src/components/dashboard/dashboard-topbar.tsx",
);

for (const path of [sidebarPath, sidebarCssPath, topbarPath]) {
  if (!existsSync(path)) {
    throw new Error(`Falta archivo requerido: ${path}`);
  }
}

function replaceRequired(text, before, after, label) {
  if (!text.includes(before)) {
    if (text.includes(after)) {
      return text;
    }

    throw new Error(`No se encontro el bloque esperado: ${label}`);
  }

  return text.replaceAll(before, after);
}

let sidebar = readFileSync(sidebarPath, "utf8");

// Preserve the current brand wordmark sizes. Only the image grows slightly.
sidebar = replaceRequired(
  sidebar,
  'isDenseRoute ? "h-10 w-10" : "h-12 w-12"',
  'isDenseRoute ? "h-11 w-11" : "h-[3.25rem] w-[3.25rem]"',
  "sidebar logo dimensions",
);

// Section labels such as Crear and Navegacion should remain structural, not dominant.
sidebar = replaceRequired(
  sidebar,
  "text-xs font-black uppercase tracking-[0.22em] text-slate-400",
  "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400",
  "sidebar section headings",
);

// Quick actions and navigation labels use medium weight. The active background,
// color and shadow remain sufficient to communicate selection.
sidebar = replaceRequired(
  sidebar,
  '"flex flex-col justify-between rounded-2xl border text-sm font-semibold transition"',
  '"flex flex-col justify-between rounded-2xl border text-sm font-medium transition"',
  "quick action typography",
);
sidebar = replaceRequired(
  sidebar,
  '"group flex items-center rounded-2xl text-sm font-semibold transition"',
  '"group flex items-center rounded-2xl text-sm font-medium transition"',
  "navigation item typography",
);

writeFileSync(sidebarPath, sidebar, "utf8");

let sidebarCss = readFileSync(sidebarCssPath, "utf8");
sidebarCss = replaceRequired(
  sidebarCss,
  ".sidebar { width: 260px; }",
  ".sidebar { width: 268px; }",
  "default sidebar width",
);
sidebarCss = replaceRequired(
  sidebarCss,
  ".sidebar:not(.sidebarDense) { width: 240px; }",
  ".sidebar:not(.sidebarDense) { width: 250px; }",
  "sidebar width up to 1440px",
);
sidebarCss = replaceRequired(
  sidebarCss,
  ".sidebar:not(.sidebarDense) { width: 220px; }",
  ".sidebar:not(.sidebarDense) { width: 230px; }",
  "sidebar width up to 1200px",
);

writeFileSync(sidebarCssPath, sidebarCss, "utf8");

let topbar = readFileSync(topbarPath, "utf8");

// Reduce typographic weight without changing the compact geometry.
topbar = replaceRequired(
  topbar,
  "truncate text-xs font-black uppercase tracking-[0.24em] text-violet-800",
  "truncate text-xs font-semibold uppercase tracking-[0.22em] text-violet-800",
  "topbar section title",
);
topbar = replaceRequired(
  topbar,
  "max-w-[180px] truncate text-xs font-black uppercase tracking-wide text-violet-950",
  "max-w-[180px] truncate text-xs font-semibold uppercase tracking-wide text-violet-950",
  "topbar user name",
);
topbar = replaceRequired(
  topbar,
  "mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500",
  "mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500",
  "topbar role",
);

writeFileSync(topbarPath, topbar, "utf8");

console.log("[OK] Sidebar aumentada ligeramente: 268/250/230px segun viewport.");
console.log("[OK] Logo aumentado a 52px normal y 44px denso.");
console.log("[OK] Textos Crear/Navegacion reducidos a semibold.");
console.log("[OK] Acciones y navegacion reducidas a medium.");
console.log("[OK] Titulo, nombre y rol de topbar con menor peso.");
