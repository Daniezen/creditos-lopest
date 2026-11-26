import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { dashboardNavigation } from "@/config/navigation";

import { buildRailItems, CASA_NEGOCIO_HREF, isRailItemActive, splitMobileItems } from "../shell/rail-items";

/**
 * The new rail and the absence of a topbar apply ONLY to Casa y Negocio
 * (spec §1). Route groups decide which layout wraps a page, so these checks
 * read the app tree: the module's shell is imported only by its own layout,
 * the app's DashboardShell never wraps the module, and every module page
 * lives under the module's group.
 */
const APP = join(__dirname, "..", "..", "..", "app");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const appFiles = files(APP).filter((path) => /\.(tsx?|jsx?)$/.test(path));
const rel = (path: string) => relative(APP, path).split(sep).join("/");
const source = (path: string) => readFileSync(path, "utf8");

describe("the module rail is scoped to Casa y Negocio", () => {
  it("is imported only by the (casa-negocio) layout", () => {
    const importers = appFiles.filter((path) => /components\/casa-negocio\/shell\//.test(source(path))).map(rel);
    expect(importers).toEqual(["(casa-negocio)/layout.tsx"]);
  });

  it("keeps the app shell (sidebar + topbar) for the rest, never inside the module", () => {
    const importers = appFiles.filter((path) => /components\/dashboard\/dashboard-shell/.test(source(path))).map(rel);
    expect(importers).toEqual(["(dashboard)/layout.tsx"]);
    expect(source(join(APP, "(casa-negocio)", "layout.tsx"))).not.toMatch(/import[^;]*components\/dashboard\//);
  });

  it("serves every module page from the module group, and nothing else from it", () => {
    const pages = appFiles.filter((path) => path.endsWith(`${sep}page.tsx`)).map(rel);
    const modulePages = pages.filter((path) => path.includes("casa-negocio/"));
    expect(modulePages.length).toBeGreaterThan(0);
    expect(modulePages.every((path) => path.startsWith("(casa-negocio)/casa-negocio/"))).toBe(true);
    expect(pages.filter((path) => path.startsWith("(casa-negocio)/")).every((path) => path.includes("/casa-negocio/"))).toBe(true);
  });

  it("guards the module with the same requireUser as the rest of the app, then casa_negocio.ver", () => {
    const layout = source(join(APP, "(casa-negocio)", "layout.tsx"));
    expect(layout).toMatch(/await requireUser\(\)/);
    expect(layout).toMatch(/capacidades\.has\("VER"\) \? children : <NoAccess \/>/);
  });
});

describe("rail destinations", () => {
  const items = buildRailItems();

  it("are the app sidebar's, in its order, plus Casa y Negocio at the end", () => {
    const sinModulo = dashboardNavigation.filter((item) => item.href !== CASA_NEGOCIO_HREF).map((item) => item.href);
    expect(items.map((item) => item.href)).toEqual([...sinModulo, CASA_NEGOCIO_HREF]);
    expect(items.filter((item) => item.href === CASA_NEGOCIO_HREF)).toHaveLength(1);
  });

  it("use the canvas' short names and glyphs", () => {
    expect(items.map((item) => item.shortLabel)).toEqual([
      "Simulador",
      "Clientes",
      "Créditos",
      "Transferir",
      "Reportes",
      "Casa y Negocio",
    ]);
    expect(items.every((item) => item.glyph)).toBe(true);
  });

  it("keep a destination added to the sidebar tomorrow, with its own icon and name", () => {
    const extra = { ...dashboardNavigation[0], href: "/nuevo", label: "Nuevo módulo" };
    const withExtra = buildRailItems([...dashboardNavigation, extra]);
    expect(withExtra.find((item) => item.href === "/nuevo")).toMatchObject({ shortLabel: "Nuevo módulo", glyph: null });
  });

  it("mark the active item on its page and below it, not on a prefix lookalike", () => {
    expect(isRailItemActive(CASA_NEGOCIO_HREF, "/casa-negocio")).toBe(true);
    expect(isRailItemActive(CASA_NEGOCIO_HREF, "/casa-negocio/arqueo")).toBe(true);
    expect(isRailItemActive("/creditos", "/creditos-viejos")).toBe(false);
    expect(isRailItemActive("/creditos", null)).toBe(false);
  });

  it("split for the phone bar: Clientes, Créditos, Casa, Reportes; the rest in «Más»", () => {
    const { primary, more } = splitMobileItems(items);
    expect(primary.map((item) => item.shortLabel)).toEqual(["Clientes", "Créditos", "Casa", "Reportes"]);
    expect(more.map((item) => item.href)).toEqual(["/simulador", "/transferencias"]);
  });
});
