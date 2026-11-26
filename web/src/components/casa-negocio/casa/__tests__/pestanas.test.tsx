/**
 * Server render of the Casa and Negocio tabs from the view models (no
 * browser here): the canvas structure, read-only mode, the empty and «sin
 * cuentas» states, the inline account picker, the phone cards and the
 * pure form helpers.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(casa-negocio)/casa-negocio/casa/actions", () => ({
  anotarMovimientoAction: vi.fn(),
  editarMovimientoAction: vi.fn(),
  anularMovimientoAction: vi.fn(),
}));
vi.mock("@/app/(casa-negocio)/casa-negocio/negocio/actions", () => ({ asignarCuentaAction: vi.fn() }));

import { construirVistaCasa } from "@/server/casa-negocio/vista-casa";
import { construirVistaNegocio } from "@/server/casa-negocio/vista-negocio";
import { cuenta, mes } from "@/server/casa-negocio/__tests__/vistas.fixture";

import { NegocioTab } from "../../negocio/negocio-tab";
import { avisoSinSaldo } from "../aviso-salida";
import { CasaTab } from "../casa-tab";
import { formatearMonto, montoInicial, montoNumero, payloadDe } from "../formas";

const casa = (datos = mes()) => renderToStaticMarkup(<CasaTab vista={construirVistaCasa(datos)} />);
const negocio = (datos = mes()) => renderToStaticMarkup(<NegocioTab vista={construirVistaNegocio(datos)} />);
const lectura = () => mes({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } });

describe("Casa", () => {
  const html = casa();

  it("draws the strip, the form with its three kinds and the button last", () => {
    expect(html).toContain('aria-label="Casa este mes"');
    expect(html).toContain("Entró $ 3.400.000, menos Fijos $ 1.787.000");
    expect(html).toContain("Anotar en la casa");
    expect(html.match(/aria-pressed="(true|false)"[^>]*>(Fijo|Variable|Ingreso)</g)?.length).toBe(3);
    const campos = ["Gasto fijo", "Monto", "Pagado desde", "Fecha"].map((l) => html.indexOf(`>${l}</label>`));
    expect(campos.every((i, k) => i > 0 && (k === 0 || i > campos[k - 1]))).toBe(true);
    expect(html.indexOf('type="submit"')).toBeGreaterThan(campos[3]);
  });

  it("offers the unpaid fijos as chips and pre-fills the first", () => {
    expect(html).toContain("Sin pagar:");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Seguros Bolo · \$ 170\.000/);
    expect(html).toContain('value="170.000"');
  });

  it("groups the book by day and shows the notices beside fijos and sobres", () => {
    expect(html).toContain('aria-label="1 de diciembre"');
    expect(html).toContain("Retiro del negocio");
    expect(html).toContain("Seguros Bolo sin pagar desde el 15 · $ 170.000");
    expect(html).toContain("Gasolina va en el 93 % del tope");
    expect(html).toContain("Fijos de diciembre");
    expect(html).toContain('aria-label="Editar Arriendo"');
    // Retiros are edited in Negocio.
    expect(html).not.toContain('aria-label="Editar Retiro del negocio"');
  });

  it("is read-only without anotar: no form, no edit buttons", () => {
    const ro = casa(lectura());
    expect(ro).not.toContain("Anotar en la casa");
    expect(ro).not.toContain("Editar ");
    expect(ro).toContain("Fijos de diciembre");
  });

  it("shows the empty book and the missing-account state", () => {
    const vacio = casa(mes({ movimientos: [], cuentas: [cuenta("banco", "Bancolombia", "NEGOCIO", 0)] }));
    expect(vacio).toContain("Nada anotado en diciembre.");
    expect(vacio).toContain("Para anotar falta una cuenta de la casa.");
    expect(vacio).not.toContain('id="anotar-casa"');
  });
});

describe("Negocio", () => {
  const html = negocio();

  it("draws the equation, the account filters and the form with «Sale de → Llega a»", () => {
    expect(html).toContain('aria-label="Negocio este mes"');
    expect(html).toMatch(/aria-pressed="true"[^>]*><span[^>]*>Todo el negocio/);
    expect(html).toContain("Faltan $ 50.000");
    expect(html).toContain("Anotar en el negocio");
    expect(html.indexOf(">Sale de</label>")).toBeLessThan(html.indexOf(">Llega a</label>"));
  });

  it("marks automatic rows with L and manual ones with the pencil", () => {
    expect(html).toContain("Lo trae Lopest desde Créditos");
    expect(html).toContain("Anotado a mano");
    expect(html).toContain("de María");
  });

  it("puts the inline picker on unassigned rows, starting on the suggested account", () => {
    expect(html).toContain("¿Dónde entró?");
    expect(html).toContain("¿De dónde salió?");
    expect(html).toMatch(/<select[^>]*data-asignar=""/);
    expect(html).toMatch(/<option value="banco" selected="">Bancolombia<\/option>/);
  });

  it("renders the book as a table and as phone cards", () => {
    expect(html).toContain("<table");
    expect(html.match(/aria-label="Libro de caja"/g)?.length).toBe(2);
  });

  it("lists pending assignments of other months", () => {
    const datos = mes();
    const otro = { ...datos.cobros[1], eventoFinancieroId: "ev9", fechaPago: "2026-11-28" };
    expect(negocio({ ...datos, sinCuenta: { cobros: [otro], desembolsos: [] } })).toContain("Sin cuenta de otros meses · 1");
  });

  it("is read-only without anotar: no form, pickers or edit buttons", () => {
    const ro = negocio(lectura());
    expect(ro).not.toContain("Anotar en el negocio");
    expect(ro).not.toContain("data-asignar");
    expect(ro).not.toContain("Editar ");
    expect(ro).toContain("Sin cuenta");
  });

  it("explains a month without business accounts", () => {
    expect(negocio(mes({ cuentas: [cuenta("casa", "Cuenta casa", "CASA", 0)] }))).toContain("Aún no hay cuentas del negocio");
  });
});

describe("form helpers", () => {
  it("groups amounts while typing and reads them back", () => {
    expect(formatearMonto("1787000")).toBe("1.787.000");
    expect(formatearMonto("$ 1.500,509")).toBe("1.500,50");
    expect(montoInicial(170000)).toBe("170.000");
    expect(montoInicial(1250.5)).toBe("1.250,50");
    expect(montoNumero("1.250,50")).toBe(1250.5);
  });

  it("sends empty the fields a kind does not use", () => {
    expect(
      payloadDe({ tipo: "INGRESO_CASA", fecha: "2026-12-01", monto: "1", cuentaOrigenId: "x", cuentaDestinoId: "casa", categoriaId: "y", nota: "Regalo" }),
    ).toEqual({ tipo: "INGRESO_CASA", fecha: "2026-12-01", monto: "1", cuentaOrigenId: "", cuentaDestinoId: "casa", categoriaId: "", nota: "Regalo" });
  });

  it("raises alert 7 only below zero, counting back what an edit already took", () => {
    const nequi = { id: "nequi", nombre: "Nequi", saldoActual: 100_000 };
    expect(avisoSinSaldo(nequi, 100_000)).toBeNull();
    expect(avisoSinSaldo(nequi, 150_000)).toBe("Nequi quedaría en −$ 50.000");
    expect(avisoSinSaldo(nequi, 150_000, 50_000)).toBeNull();
  });
});
