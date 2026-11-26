import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { construirEncabezado } from "@/server/casa-negocio/vista-encabezado";
import { evaluarMes } from "@/server/casa-negocio/vista-mes";
import { construirTablero } from "@/server/casa-negocio/vista-tablero";
import { mesDiciembre } from "@/server/casa-negocio/__tests__/mes.fixture";

import { demoTablero } from "../fixtures/canvas-noviembre";
import { trapIndex } from "../shared/focus-trap";
import { ModuleSkeleton } from "../states/module-skeleton";
import { NoAccess } from "../states/no-access";
import { calendarDayLabel, neighbourDay } from "../tablero/calendar-grid";
import { compactTerms } from "../tablero/equation-compact";
import { MonthEquations } from "../tablero/month-equations";
import { Tablero } from "../tablero/tablero";
import type { EquationRow } from "../types";

/**
 * Phase-3 polish of the Tablero and the module frame: keyboard helpers,
 * phone reading of the equations, read-only, empty and pre-module states,
 * and the loading frame. Server render only (no browser here).
 */

describe("trampa de foco", () => {
  it("da la vuelta en ambos sentidos y entra por el extremo correcto", () => {
    expect(trapIndex(3, 2, false)).toBe(0);
    expect(trapIndex(3, 0, true)).toBe(2);
    expect(trapIndex(3, 1, false)).toBe(2);
    expect(trapIndex(3, -1, false)).toBe(0);
    expect(trapIndex(3, -1, true)).toBe(2);
    expect(trapIndex(0, -1, false)).toBe(-1);
  });
});

describe("calendario con teclado y sin depender del color", () => {
  const dias = [1, 5, 10, 16, 20, 30];

  it("las flechas recorren solo los días con algo", () => {
    expect(neighbourDay(dias, 10, "ArrowRight")).toBe(16);
    expect(neighbourDay(dias, 10, "ArrowLeft")).toBe(5);
    expect(neighbourDay(dias, 10, "ArrowDown")).toBe(20);
    expect(neighbourDay(dias, 16, "ArrowUp")).toBe(5);
    expect(neighbourDay(dias, 1, "Home")).toBeNull();
    expect(neighbourDay(dias, 10, "End")).toBe(30);
    expect(neighbourDay(dias, 30, "ArrowRight")).toBeNull();
    expect(neighbourDay(dias, 10, "Enter")).toBeNull();
  });

  it("sin nada a una semana va al último (o primer) día que queda", () => {
    expect(neighbourDay([1, 3, 5], 1, "ArrowDown")).toBe(5);
    expect(neighbourDay([1, 3, 5], 5, "ArrowUp")).toBe(1);
  });

  it("nombra lo que significa cada punto", () => {
    expect(calendarDayLabel("16 de noviembre", ["casa", "falta", "falta"])).toBe(
      "16 de noviembre: 1 movimiento de la casa, 2 pendientes",
    );
    expect(calendarDayLabel("3 de noviembre", [])).toBe("3 de noviembre");
  });
});

describe("cuentas del mes en el celular", () => {
  const negocio: EquationRow = {
    name: "Negocio",
    identity: "negocio",
    terms: [
      { op: "", label: "Intereses", amount: 6_240_000 },
      { op: "−", label: "Gastos", amount: 180_000 },
      { op: "−", label: "Perdidos", amount: 0 },
      { op: "=", label: "Ganancia", amount: 6_060_000, result: true },
      { op: "−", label: "A la casa", amount: 5_500_000 },
      { op: "=", label: "Reinvertido", amount: 560_000, result: true },
    ],
  };
  const casa: EquationRow = {
    name: "Casa",
    identity: "casa",
    terms: [
      { op: "", label: "Entró", amount: 5_500_000 },
      { op: "−", label: "Fijos", amount: 2_727_000 },
      { op: "−", label: "Variables", amount: 1_940_000 },
      { op: "=", label: "Hoy", amount: 833_000, result: true },
      { op: "−", label: "Fijos sin pagar", amount: 0 },
      { op: "=", label: "Al cierre", amount: 0, result: true },
    ],
  };

  it("quita los términos en cero pero nunca el primero ni los resultados", () => {
    expect(compactTerms(negocio).map((t) => t.label)).toEqual(["Intereses", "Gastos", "Ganancia", "A la casa", "Reinvertido"]);
  });

  it("la casa junta fijos y variables en «Gastado» como el lienzo", () => {
    const terms = compactTerms(casa);
    expect(terms.map((t) => t.label)).toEqual(["Entró", "Gastado", "Hoy", "Al cierre"]);
    expect(terms[1].amount).toBe(4_667_000);
  });

  it("solo lectura muestra los avisos sin sus acciones", () => {
    const rows = demoTablero.equations.map((row) => ({
      ...row,
      notices: [{ level: "atencion" as const, text: "Vence el SOAT", action: { label: "Pagar", href: "/casa-negocio?anotar=gastoCasa" } }],
    }));
    expect(renderToStaticMarkup(<MonthEquations rows={rows} />)).toContain(">Pagar</a>");
    const html = renderToStaticMarkup(<MonthEquations rows={rows} readOnly />);
    expect(html).toContain("Vence el SOAT");
    expect(html).not.toContain(">Pagar</a>");
  });
});

describe("estados del Tablero", () => {
  it("un mes antes del inicio no muestra cifras, solo dónde empieza", () => {
    const noviembre = mesDiciembre({ mes: "2026-11", hoy: "2026-11-26" });
    const vista = construirTablero(noviembre, evaluarMes(noviembre));
    expect(vista).toEqual({
      estado: "antes-del-inicio",
      titulo: "Casa y Negocio empieza el 1 de diciembre",
      accion: { label: "Ver diciembre", href: "/casa-negocio?mes=2026-12" },
    });
    const header = construirEncabezado({ datos: noviembre, evaluado: evaluarMes(noviembre), tab: "tablero", consulta: {} });
    expect(header.summary).toBeUndefined();
    expect(header.month.prevHref).toBeNull();
  });

  it("sin sobres configurados no dibuja la sección vacía", () => {
    const html = renderToStaticMarkup(<Tablero data={{ ...demoTablero, envelopes: [] }} readOnly={false} />);
    expect(html).not.toContain("Sobres de la casa");
  });

  it("sin saldo positivo la barra de cuentas conserva su pista", () => {
    const data = { ...demoTablero, money: { total: 0, accounts: demoTablero.money.accounts.map((a) => ({ ...a, balance: 0 })) } };
    expect(renderToStaticMarkup(<Tablero data={data} readOnly={false} />)).toContain("bg-[var(--cn-color-track)]");
  });

  it("la madre (solo ver) no recibe nada para editar en el Tablero real", () => {
    const madre = mesDiciembre({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } });
    const vista = construirTablero(madre, evaluarMes(madre));
    if (vista.estado !== "listo") throw new Error("listo");
    const html = renderToStaticMarkup(<Tablero data={vista.data} readOnly />);
    expect(html).not.toContain("anotar=");
    expect(html).not.toMatch(/<(input|select|textarea|form)\b/);
  });
});

describe("marco del módulo", () => {
  it("el esqueleto reproduce línea y pestañas sin enlaces", () => {
    const html = renderToStaticMarkup(<ModuleSkeleton />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Configuración");
    expect(html).not.toContain("<a ");
  });

  it("sin acceso conserva un h1", () => {
    expect(renderToStaticMarkup(<NoAccess />)).toMatch(/<h1[^>]*>Casa y Negocio<\/h1>/);
  });
});
