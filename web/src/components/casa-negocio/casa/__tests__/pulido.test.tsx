/**
 * Phase-3 polish of the Casa and Negocio tabs, checked without a browser:
 * pasted amounts, focus helpers (first error, where the focus goes after a
 * dialog), the live regions of the status line, touch-target and
 * container-query recipes, and the read-only render. Interaction itself
 * (clicks, real focus) is not exercised here: there is no DOM in this suite.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(casa-negocio)/casa-negocio/casa/actions", () => ({
  anotarMovimientoAction: vi.fn(),
  editarMovimientoAction: vi.fn(),
  anularMovimientoAction: vi.fn(),
}));
vi.mock("@/app/(casa-negocio)/casa-negocio/negocio/actions", () => ({ asignarCuentaAction: vi.fn() }));

import { cnCasaRecipes, cnFormRecipes, cnNegocioRecipes } from "@/design-system/recipes/casa-negocio-libros";
import { construirVistaCasa } from "@/server/casa-negocio/vista-casa";
import { construirVistaNegocio } from "@/server/casa-negocio/vista-negocio";
import { mes } from "@/server/casa-negocio/__tests__/vistas.fixture";

import { NegocioTab } from "../../negocio/negocio-tab";
import { CasaTab } from "../casa-tab";
import { EstadoLinea, enfocarPrimerError } from "../campos";
import { destinoDelFoco } from "../editar-movimiento";
import { montoNumero, normalizarPegado } from "../formas";

const casa = (datos = mes()) => renderToStaticMarkup(<CasaTab vista={construirVistaCasa(datos)} />);
const negocio = (datos = mes()) => renderToStaticMarkup(<NegocioTab vista={construirVistaNegocio(datos)} />);
const lectura = () => mes({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } });

describe("pasted amounts", () => {
  it.each([
    ["1.787.000", "1.787.000"],
    ["$ 1.787.000", "1.787.000"],
    ["1,787,000", "1.787.000"],
    ["1,500", "1.500"],
    ["1.500", "1.500"],
    ["1787000.5", "1.787.000,5"],
    ["1,787,000.50", "1.787.000,50"],
    ["1.787.000,50", "1.787.000,50"],
    ["COP 250 000", "250.000"],
    ["12,5", "12,5"],
  ])("reads %s as %s", (pegado, campo) => {
    expect(normalizarPegado(pegado)).toBe(campo);
  });

  it("produces what the server parses back to the same pesos", () => {
    expect(montoNumero(normalizarPegado("1,787,000.50"))).toBe(1_787_000.5);
    expect(montoNumero(normalizarPegado("1,500"))).toBe(1500);
  });
});

describe("focus helpers", () => {
  it("focuses the first control marked invalid, if any", () => {
    const focus = vi.fn();
    const raiz = { querySelector: vi.fn(() => ({ focus })) } as unknown as ParentNode;
    expect(enfocarPrimerError(raiz)).toBe(true);
    expect(raiz.querySelector).toHaveBeenCalledWith('[aria-invalid="true"]');
    expect(focus).toHaveBeenCalledOnce();
    expect(enfocarPrimerError({ querySelector: () => null })).toBe(false);
    expect(enfocarPrimerError(null)).toBe(false);
  });

  it("returns focus to the pencil, or to the book when the row left", () => {
    const boton = { isConnected: true } as HTMLElement;
    const suelto = { isConnected: false } as HTMLElement;
    const libro = { isConnected: true } as HTMLElement;
    expect(destinoDelFoco(boton, libro, false)).toBe(boton);
    expect(destinoDelFoco(boton, libro, true)).toBe(libro);
    expect(destinoDelFoco(suelto, libro, false)).toBe(libro);
    expect(destinoDelFoco(boton, null, true)).toBe(boton);
  });
});

describe("status line", () => {
  it("keeps both live regions mounted and says «Error» in words", () => {
    const vacio = renderToStaticMarkup(<EstadoLinea estado={{ mensaje: null, ok: false, campos: {}, serie: 0 }} />);
    expect(vacio).toContain('role="status"');
    expect(vacio).toContain('role="alert"');
    const error = renderToStaticMarkup(<EstadoLinea estado={{ mensaje: "Revisa los campos marcados.", ok: false, campos: {}, serie: 1 }} />);
    expect(error).toMatch(/role="alert"[^>]*><span class="sr-only">Error: <\/span>Revisa los campos marcados\./);
    const ok = renderToStaticMarkup(<EstadoLinea estado={{ mensaje: "Anotado.", ok: true, campos: {}, serie: 2 }} />);
    expect(ok).toMatch(/role="status"[^>]*>Anotado\./);
  });
});

describe("touch and narrow screens", () => {
  it("grows segments, chips, the pencil and the picker to 44 px on touch", () => {
    for (const receta of [cnFormRecipes.segment, cnFormRecipes.chip, cnNegocioRecipes.assignSelect, cnNegocioRecipes.assignSave]) {
      expect(receta).toContain("max-md:min-h-11");
      expect(receta).toContain("pointer-coarse:min-h-11");
    }
    expect(cnCasaRecipes.rowEdit).toContain("max-md:size-11");
  });

  it("switches the cash book between table and cards by its own width", () => {
    expect(cnNegocioRecipes.bookFrame).toContain("@container");
    expect(cnNegocioRecipes.book).toMatch(/\bhidden\b.*@4xl:block/);
    expect(cnNegocioRecipes.cards).toContain("@4xl:hidden");
    const html = negocio();
    expect(html).toContain(`class="${cnNegocioRecipes.bookFrame}"`);
    expect(html).toContain('<caption class="sr-only">Libro de caja de diciembre</caption>');
  });

  it("asks phones for the digits keypad on money", () => {
    expect(casa()).toMatch(/name="monto"[^>]*inputMode="numeric"|inputMode="numeric"[^>]*name="monto"/);
    expect(negocio()).toContain('inputMode="numeric"');
  });
});

describe("render details", () => {
  it("marks the books as focus targets and the pencil as opening a dialog", () => {
    expect(casa()).toMatch(/aria-label="Libro de la casa"[^>]*tabindex="-1"[^>]*data-libro=""/);
    expect(casa()).toContain('aria-haspopup="dialog"');
    expect(negocio()).toContain('data-libro=""');
  });

  it("speaks the kind of each Casa row, not only its dot colour", () => {
    expect(casa()).toMatch(/<span class="sr-only">Fijo: <\/span>Arriendo/);
  });

  it("read-only viewers get no form, account select, picker or pencil", () => {
    const c = casa(lectura());
    const n = negocio(lectura());
    for (const html of [c, n]) {
      expect(html).not.toContain('type="submit"');
      expect(html).not.toContain("<select");
      expect(html).not.toContain('aria-haspopup="dialog"');
    }
    // The figures stay: the strip and the books are still drawn.
    expect(c).toContain('aria-label="Casa este mes"');
    expect(n).toContain('aria-label="Negocio este mes"');
  });
});
