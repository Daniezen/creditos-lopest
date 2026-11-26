import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { construirEncabezado } from "@/server/casa-negocio/vista-encabezado";
import { evaluarMes } from "@/server/casa-negocio/vista-mes";
import { construirTablero } from "@/server/casa-negocio/vista-tablero";
import { mesDiciembre } from "@/server/casa-negocio/__tests__/mes.fixture";

import { ModuleHeader } from "../header/module-header";
import { noBalanceNotice, parseTypedAmount } from "../header/quick-entry-panel";
import { Tablero } from "../tablero/tablero";

/** Server render of the real header model in its states (no browser here). */
function header(datos = mesDiciembre(), consulta: Record<string, string> = {}) {
  return renderToStaticMarkup(<ModuleHeader {...construirEncabezado({ datos, evaluado: evaluarMes(datos), tab: "tablero", consulta })} />);
}

describe("encabezado con datos", () => {
  it("con anotar muestra «Anotar» y el botón flotante, sin el sello", () => {
    const html = header();
    expect(html).toContain(">Anotar</button>");
    expect(html).toContain('aria-label="Anotar movimiento"');
    expect(html).not.toContain("Solo lectura");
  });

  it("sin anotar muestra «Solo lectura» y ninguna forma de anotar", () => {
    const html = header(mesDiciembre({ usuario: { id: "m", nombre: "Madre", capacidades: ["VER"] } }));
    expect(html).toContain("Solo lectura");
    expect(html).not.toContain("Anotar");
  });

  it("sin cuentas no ofrece anotar (no hay dónde) ni dice solo lectura", () => {
    const html = header(mesDiciembre({ cuentas: [] }));
    expect(html).not.toContain(">Anotar</button>");
    expect(html).not.toContain("Solo lectura");
  });

  it("«Pagar» llega con el panel abierto y precargado", () => {
    const html = header(mesDiciembre(), { anotar: "gastoCasa", categoria: "funeraria", monto: "32000" });
    expect(html).toContain('aria-label="Anotar rápido"');
    expect(html).toMatch(/<option value="funeraria" selected="">Funeraria · sin pagar<\/option>/);
    expect(html).toContain('value="32000"');
    // Demo-free header without an action wired: «Guardar» stays disabled.
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });
});

describe("aviso 7 en el panel", () => {
  const options = construirEncabezado({ datos: mesDiciembre(), evaluado: evaluarMes(mesDiciembre()), tab: "tablero", consulta: {} }).quickEntry!.options;

  it("lee montos escritos a la colombiana", () => {
    expect(parseTypedAmount("$ 1.500.000")).toBe(1_500_000);
    expect(parseTypedAmount("")).toBeNaN();
  });

  it("avisa solo cuando la cuenta quedaría por debajo de cero", () => {
    expect(noBalanceNotice(options, "nequi", "1.600.000")).toBeNull();
    expect(noBalanceNotice(options, "nequi", "1.700.000")).toBe("Nequi quedaría en −$ 100.000");
    expect(noBalanceNotice(options, "cuenta:casa", "900.000")).toBe("Cuenta casa quedaría en −$ 67.000");
    expect(noBalanceNotice({ ...options, avisoSinSaldo: false }, "nequi", "9.000.000")).toBeNull();
  });
});

describe("Tablero con datos", () => {
  it("dibuja un mes sin movimientos con el texto tranquilo en vez de barras", () => {
    const quieto = mesDiciembre({ mes: "2027-02", movimientos: [], cobros: [], cuotasPorCobrar: [] });
    const vista = construirTablero(quieto, evaluarMes(quieto));
    if (vista.estado !== "listo") throw new Error("listo");
    const html = renderToStaticMarkup(<Tablero data={vista.data} readOnly={false} />);
    expect(html).toContain("Sin movimientos en febrero.");
    expect(html).not.toContain("Entró al negocio");
  });
});
