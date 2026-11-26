/**
 * Server render of the Ahorro and Arqueo tabs (no browser here): the markup
 * contract that matters — the states, the real controls, read-only mode and
 * the phone layout classes (cards in one column, ring first).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { cnArqueoRecipes } from "@/design-system/recipes/casa-negocio-ahorro-arqueo";
import { mesFixture, movimiento } from "@/server/casa-negocio/__tests__/mes-fixture";
import { construirVistaAhorro } from "@/server/casa-negocio/vista-ahorro";
import { construirVistaArqueo } from "@/server/casa-negocio/vista-arqueo";

import { AhorroView } from "../ahorro/ahorro-view";
import { ringDash } from "../ahorro/goal-ring";
import { ArqueoView } from "../arqueo/arqueo-view";

const noviembre = mesFixture({
  movimientos: [
    movimiento("r1", "RETIRO_CASA", 6_500_000),
    movimiento("f1", "GASTO_FIJO", 2_727_000),
    movimiento("v1", "GASTO_VARIABLE", 3_142_000),
  ],
});
const pasar = async () => ({ ok: true as const, mensaje: "ok", datos: undefined });

describe("Ahorro markup", () => {
  it("draws the ring with its share, then the dark cierre card with its button", () => {
    const html = renderToStaticMarkup(<AhorroView vista={construirVistaAhorro(noviembre, [])} pasar={pasar} />);
    expect(html).toContain('aria-label="35 por ciento de la meta de ahorro"');
    expect(html).toContain(`stroke-dasharray="${ringDash(35)}"`);
    expect(html).toContain("$ 7.006.000");
    expect(html).toContain("Faltan $ 12.994.000");
    expect(html).toContain("Cierre de noviembre");
    expect(html).toContain("$ 631.000");
    expect(html).toMatch(/<button type="button"[^>]*>Pasar al ahorro<\/button>/);
    // Ring before the cierre card in source order: on phones they stack ring first.
    expect(html.indexOf("de la meta")).toBeLessThan(html.indexOf("Cierre de noviembre"));
    expect(html).toContain("Lo que entró cada mes");
  });

  it("without `anotar` there is no button; once passed it says so", () => {
    const madre = { ...noviembre, usuario: { id: "m", nombre: "Madre", capacidades: ["VER" as const] } };
    expect(renderToStaticMarkup(<AhorroView vista={construirVistaAhorro(madre, [])} />)).not.toContain("Pasar al ahorro");

    const hecho = construirVistaAhorro(noviembre, [{ movimientoId: "m", mes: "2026-11", fecha: "2026-11-25", monto: 631_000, anulado: false }]);
    const html = renderToStaticMarkup(<AhorroView vista={hecho} pasar={pasar} />);
    expect(html).not.toContain("Pasar al ahorro");
    expect(html).toContain("En el ahorro · 25 de noviembre");
  });

  it("without a savings account leads to Configuración", () => {
    const sin = { ...noviembre, configuracion: { ...noviembre.configuracion, cuentaAhorroId: null } };
    const html = renderToStaticMarkup(<AhorroView vista={construirVistaAhorro(sin, [])} />);
    expect(html).toContain("Falta la cuenta de ahorro");
    expect(html).toContain('href="/casa-negocio/configuracion"');
  });
});

describe("Arqueo markup", () => {
  const vista = construirVistaArqueo(mesFixture());

  it("summary, cards grouped Negocio / Casa with a labelled «Contaste» field each", () => {
    const html = renderToStaticMarkup(<ArqueoView vista={vista} guardar={async () => ({ ok: true, mensaje: "", datos: undefined })} />);
    expect(html).toMatch(/0 de 5<\/span>/);
    expect(html.indexOf(">Negocio<")).toBeLessThan(html.indexOf(">Casa<"));
    expect((html.match(/<label for="contado-/g) ?? []).length).toBe(5);
    expect((html.match(/Por contar/g) ?? []).length).toBe(5);
    expect(html).toContain("$ 11.900.000");
    // Nothing counted yet: the save button exists but is disabled.
    expect(html).toMatch(/<button type="button"[^>]*disabled=""[^>]*>Guardar arqueo<\/button>/);
    // Phone: the card grid collapses to one column.
    expect(cnArqueoRecipes.grid).toContain("max-md:grid-cols-1");
  });

  it("without `contar` nothing is editable: no field, no live tally, no save", () => {
    const sinContar = construirVistaArqueo(mesFixture({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } }));
    const html = renderToStaticMarkup(<ArqueoView vista={sinContar} />);
    expect(html).not.toContain("Guardar arqueo");
    expect(html).not.toContain("<input");
    // «0 de 5 cuadran» would be false for someone who cannot count.
    expect(html).not.toMatch(/de 5<\/span>/);
    // Still readable: what Lopest says and when each account was last counted.
    expect(html).toContain("$ 11.900.000");
    expect(html).toMatch(/Nunca contada|Contada el /);
  });

  it("with no accounts it is an empty state", () => {
    const html = renderToStaticMarkup(<ArqueoView vista={construirVistaArqueo(mesFixture({ cuentas: [] }))} />);
    expect(html).toContain("No hay cuentas para contar");
  });
});

describe("touch targets of the small controls (44px)", () => {
  it("the cierre's origin picker and Resumen's range options", async () => {
    const { cnAhorroRecipes } = await import("@/design-system/recipes/casa-negocio-ahorro-arqueo");
    const { cnResumenRecipes } = await import("@/design-system/recipes/casa-negocio");
    expect(cnAhorroRecipes.closingSelect).toContain("min-h-11");
    expect(cnResumenRecipes.rangeOption).toContain("min-h-11");
  });
});
