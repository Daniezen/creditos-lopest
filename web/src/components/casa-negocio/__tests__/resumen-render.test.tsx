import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { construirVistaResumen, type DatosResumen } from "@/server/casa-negocio/vista-resumen";

import { Resumen } from "../resumen/resumen";

/**
 * Server render of the Resumen tab (no browser): headings, the text reading
 * and data table of each chart, the notice, the current month in ink and the
 * 12/24 range links. The ECharts drawing itself only mounts in a browser.
 */
const dia = (d: string) => new Date(`${d}T05:00:00.000Z`);

function vista(extra: Partial<DatosResumen> = {}) {
  return construirVistaResumen({
    hoy: "2026-11-25",
    inicioModulo: "2026-10-01",
    rango: 12,
    cobros: [
      { tipo: "CUOTA_PROGRAMADA", fechaPago: dia("2026-10-10"), montoPagado: 1_300_000, capitalPagado: 1_000_000, interesPagado: 300_000, capitalProgramado: 1_000_000, interesProgramado: 300_000 },
    ],
    programadas: [{ fechaProgramada: dia("2026-10-10"), capitalProgramado: 1_000_000, interesProgramado: 300_000 }],
    pendientes: [{ fechaProgramada: dia("2026-12-10"), capitalProgramado: 1_000_000, interesProgramado: 300_000, capitalPagado: 0, interesPagado: 0 }],
    movimientos: [{ mes: "2026-10", tipo: "RETIRO_CASA", monto: 500_000, tipoOrigen: "BANCO", tipoDestino: "BANCO" }],
    castigos: [],
    ahorroFinMes: {},
    tramos: [
      { tramo: "AL_DIA", creditos: 1, saldoCapital: 9_000_000, montoVencido: 0 },
      { tramo: "1_30", creditos: 0, saldoCapital: 0, montoVencido: 0 },
      { tramo: "31_60", creditos: 0, saldoCapital: 0, montoVencido: 0 },
      { tramo: "61_90", creditos: 0, saldoCapital: 0, montoVencido: 0 },
      { tramo: "MAS_90", creditos: 1, saldoCapital: 1_000_000, montoVencido: 400_000 },
    ],
    ...extra,
  });
}

const render = (v = vista()) => renderToStaticMarkup(<Resumen vista={v} rangoHref={(r) => `?rango=${r}`} />);

describe("Resumen markup", () => {
  const html = render();

  it("tiene las cuatro secciones con título", () => {
    for (const t of ["Ganancia y retiros", "Cobros: lo que entró y lo que viene", "Cómo está pagando la cartera", "Mes a mes"]) {
      expect(html).toContain(t);
    }
  });

  it("lee cada gráfica en texto y deja sus datos en una tabla", () => {
    expect(html).toContain("Ganancia neta y lo que se llevó la casa, de octubre 2026 a noviembre 2026.");
    expect(html).toContain("<caption>Cobros por mes</caption>");
    expect(html).toContain("Dic 2026 (por venir)");
    expect(html).toMatch(/role="img" aria-label="Cartera de \$ 10,0 M por días de atraso/);
  });

  it("avisa que el capital bajó en octubre", () => {
    expect(html).toContain("Problema: ");
    expect(html).toContain("En octubre se llevó a la casa más de lo que ganó el negocio: el capital bajó $ 200.000.");
  });

  it("pone las tres cifras de cobros", () => {
    expect(html).toContain("Cobrado en 2 meses");
    expect(html).toContain("100 % de lo que tocaba cobrar");
    expect(html).toContain("Viene en 6 meses");
  });

  it("marca el mes actual y el rango elegido", () => {
    const actual = html.match(/<li class="([^"]*)" aria-current="date"><div[^>]*>([^<]*)</);
    expect(actual?.[2]).toBe("Nov 2026");
    expect(actual?.[1]).toContain("bg-[var(--cn-color-ink)]");
    expect(actual?.[1]).not.toContain("bg-[var(--cn-color-surface)]");
    expect(html.match(/aria-current="date"/g)).toHaveLength(1);
    expect(html).toMatch(/<a aria-current="true"[^>]*href="\?rango=12"/);
    expect(html).toMatch(/<a aria-current="false"[^>]*href="\?rango=24"/);
  });

  it("sin historia muestra los vacíos en vez de gráficas rotas", () => {
    const vacia = render(vista({ cobros: [], programadas: [], pendientes: [], movimientos: [], inicioModulo: null, tramos: [] }));
    expect(vacia).toContain("Todavía no hay meses con cobros.");
    expect(vacia).toContain("Todavía no hay cobros ni cuotas por venir.");
    expect(vacia).toContain("No hay créditos activos.");
  });
});
